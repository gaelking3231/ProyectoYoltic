/// YOLTIC — BLE Service
/// 
/// Bluetooth Low Energy communication service for ESP32-S3 smart glasses.
/// Scans, connects, and receives audio data chunks which are
/// buffered and reassembled into WAV files.

import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';

/// BLE Service UUIDs (must match ESP32-S3 firmware)
class BleUuids {
  static const String serviceUuid = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
  static const String audioCharUuid = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
  static const String configCharUuid = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
  static const String statusCharUuid = 'beb5483e-36e1-4688-b7f5-ea07361b26aa';
}

/// Audio packet flags (match ESP32 protocol)
class AudioFlags {
  static const int startOfAudio = 0x01;
  static const int endOfAudio = 0x02;
  static const int streaming = 0x04;
}

/// BLE connection state
enum BleConnectionState {
  disconnected,
  scanning,
  connecting,
  connected,
  streaming,
}

class BleService extends ChangeNotifier {
  BleConnectionState _state = BleConnectionState.disconnected;
  BluetoothDevice? _connectedDevice;
  BluetoothCharacteristic? _audioCharacteristic;
  BluetoothCharacteristic? _configCharacteristic;
  StreamSubscription? _scanSubscription;
  StreamSubscription? _audioSubscription;
  StreamSubscription? _connectionSubscription;

  /// Audio buffer for reassembling WAV from BLE chunks
  final List<int> _audioBuffer = [];
  int _expectedSequence = 0;
  bool _isRecording = false;

  /// Callbacks
  Function(Uint8List wavData)? onAudioComplete;
  Function(String message)? onError;

  // ─── Getters ─────────────────────────────────────────────

  BleConnectionState get state => _state;
  BluetoothDevice? get connectedDevice => _connectedDevice;
  bool get isConnected => _state == BleConnectionState.connected || _state == BleConnectionState.streaming;
  bool get isStreaming => _state == BleConnectionState.streaming;
  String get deviceName => _connectedDevice?.platformName ?? 'Unknown';

  // ─── Scan for YOLTIC Glasses ─────────────────────────────

  Future<void> startScan({Duration timeout = const Duration(seconds: 10)}) async {
    if (_state == BleConnectionState.scanning) return;

    _setState(BleConnectionState.scanning);

    try {
      // Check Bluetooth availability
      if (await FlutterBluePlus.isSupported == false) {
        _onError('Bluetooth is not supported on this device');
        return;
      }

      // Start scanning with service UUID filter
      await FlutterBluePlus.startScan(
        withServices: [Guid(BleUuids.serviceUuid)],
        timeout: timeout,
      );

      _scanSubscription = FlutterBluePlus.scanResults.listen((results) {
        for (ScanResult result in results) {
          if (result.device.platformName.contains('YOLTIC') ||
              result.advertisementData.serviceUuids
                  .contains(Guid(BleUuids.serviceUuid))) {
            // Found YOLTIC glasses — auto-connect
            stopScan();
            connectToDevice(result.device);
            break;
          }
        }
      });
    } catch (e) {
      _onError('Scan failed: $e');
      _setState(BleConnectionState.disconnected);
    }
  }

  void stopScan() {
    FlutterBluePlus.stopScan();
    _scanSubscription?.cancel();
    _scanSubscription = null;
  }

  // ─── Connect to Device ───────────────────────────────────

  Future<void> connectToDevice(BluetoothDevice device) async {
    _setState(BleConnectionState.connecting);
    _connectedDevice = device;

    try {
      // Connect with auto-reconnect
      await device.connect(
        autoConnect: true,
        timeout: const Duration(seconds: 15),
      );

      // Listen for disconnection
      _connectionSubscription = device.connectionState.listen((state) {
        if (state == BluetoothConnectionState.disconnected) {
          _handleDisconnection();
        }
      });

      // Discover services
      List<BluetoothService> services = await device.discoverServices();

      for (BluetoothService service in services) {
        if (service.uuid == Guid(BleUuids.serviceUuid)) {
          for (BluetoothCharacteristic char in service.characteristics) {
            if (char.uuid == Guid(BleUuids.audioCharUuid)) {
              _audioCharacteristic = char;
            } else if (char.uuid == Guid(BleUuids.configCharUuid)) {
              _configCharacteristic = char;
            }
          }
        }
      }

      if (_audioCharacteristic == null) {
        _onError('Audio characteristic not found on device');
        await disconnect();
        return;
      }

      // Request maximum MTU for better throughput
      await device.requestMtu(517);

      // Subscribe to audio notifications
      await _audioCharacteristic!.setNotifyValue(true);
      _audioSubscription = _audioCharacteristic!.lastValueStream.listen(
        _onAudioDataReceived,
      );

      _setState(BleConnectionState.connected);
      debugPrint('🔗 Connected to YOLTIC: ${device.platformName}');
    } catch (e) {
      _onError('Connection failed: $e');
      _setState(BleConnectionState.disconnected);
    }
  }

  // ─── Handle Audio Data ───────────────────────────────────

  void _onAudioDataReceived(List<int> data) {
    if (data.length < 3) return; // Minimum: 2B seq + 1B flags

    // Parse packet header
    final seqNum = (data[0] << 8) | data[1];
    final flags = data[2];
    final audioData = data.sublist(3);

    // Start of new audio segment
    if (flags & AudioFlags.startOfAudio != 0) {
      _audioBuffer.clear();
      _expectedSequence = 0;
      _isRecording = true;
      _setState(BleConnectionState.streaming);
      debugPrint('🎙️ Audio recording started');
    }

    // Verify sequence
    if (seqNum != _expectedSequence && _isRecording) {
      debugPrint('⚠️ Packet loss: expected $seqNum, got $_expectedSequence');
    }

    // Buffer audio data
    if (_isRecording) {
      _audioBuffer.addAll(audioData);
      _expectedSequence = seqNum + 1;
    }

    // End of audio segment
    if (flags & AudioFlags.endOfAudio != 0) {
      _isRecording = false;
      _setState(BleConnectionState.connected);

      // Build WAV file from raw PCM data
      final wavData = _buildWavFile(Uint8List.fromList(_audioBuffer));
      _audioBuffer.clear();

      debugPrint('🎵 Audio complete: ${wavData.length} bytes');

      // Notify listener
      onAudioComplete?.call(wavData);
    }
  }

  // ─── Send Config to Glasses ──────────────────────────────

  Future<void> sendConfig({int? volume, String? dialect}) async {
    if (_configCharacteristic == null || !isConnected) return;

    try {
      // Config packet format: [cmd(1B)][value(variable)]
      if (volume != null) {
        await _configCharacteristic!.write(
          [0x01, volume.clamp(0, 100)],
          withoutResponse: true,
        );
      }

      if (dialect != null) {
        final dialectCode = _dialectToCode(dialect);
        await _configCharacteristic!.write(
          [0x02, dialectCode],
          withoutResponse: true,
        );
      }
    } catch (e) {
      _onError('Config send failed: $e');
    }
  }

  // ─── Disconnect ──────────────────────────────────────────

  Future<void> disconnect() async {
    _audioSubscription?.cancel();
    _connectionSubscription?.cancel();

    if (_connectedDevice != null) {
      try {
        await _connectedDevice!.disconnect();
      } catch (e) {
        debugPrint('Disconnect error: $e');
      }
    }

    _connectedDevice = null;
    _audioCharacteristic = null;
    _configCharacteristic = null;
    _audioBuffer.clear();
    _isRecording = false;
    _setState(BleConnectionState.disconnected);
  }

  // ─── Helpers ─────────────────────────────────────────────

  void _handleDisconnection() {
    debugPrint('📡 Device disconnected');
    _audioSubscription?.cancel();
    _connectedDevice = null;
    _audioCharacteristic = null;
    _configCharacteristic = null;
    _audioBuffer.clear();
    _isRecording = false;
    _setState(BleConnectionState.disconnected);

    // Auto-reconnect after 3 seconds
    Future.delayed(const Duration(seconds: 3), () {
      if (_state == BleConnectionState.disconnected) {
        startScan();
      }
    });
  }

  void _setState(BleConnectionState newState) {
    _state = newState;
    notifyListeners();
  }

  void _onError(String message) {
    debugPrint('❌ BLE Error: $message');
    onError?.call(message);
  }

  int _dialectToCode(String dialect) {
    switch (dialect) {
      case 'valley': return 0x01;
      case 'isthmus': return 0x02;
      case 'sierra_norte': return 0x03;
      case 'sierra_sur': return 0x04;
      default: return 0x01;
    }
  }

  /// Build a WAV file from raw PCM data
  /// Format: 16-bit PCM, mono, 16000 Hz
  Uint8List _buildWavFile(Uint8List pcmData) {
    final int dataSize = pcmData.length;
    final int fileSize = 36 + dataSize;

    final ByteData header = ByteData(44);

    // RIFF header
    header.setUint8(0, 0x52);  // R
    header.setUint8(1, 0x49);  // I
    header.setUint8(2, 0x46);  // F
    header.setUint8(3, 0x46);  // F
    header.setUint32(4, fileSize, Endian.little);
    header.setUint8(8, 0x57);  // W
    header.setUint8(9, 0x41);  // A
    header.setUint8(10, 0x56); // V
    header.setUint8(11, 0x45); // E

    // fmt chunk
    header.setUint8(12, 0x66); // f
    header.setUint8(13, 0x6D); // m
    header.setUint8(14, 0x74); // t
    header.setUint8(15, 0x20); // (space)
    header.setUint32(16, 16, Endian.little);     // Chunk size
    header.setUint16(20, 1, Endian.little);      // PCM format
    header.setUint16(22, 1, Endian.little);      // Mono
    header.setUint32(24, 16000, Endian.little);  // Sample rate
    header.setUint32(28, 32000, Endian.little);  // Byte rate
    header.setUint16(32, 2, Endian.little);      // Block align
    header.setUint16(34, 16, Endian.little);     // Bits per sample

    // data chunk
    header.setUint8(36, 0x64); // d
    header.setUint8(37, 0x61); // a
    header.setUint8(38, 0x74); // t
    header.setUint8(39, 0x61); // a
    header.setUint32(40, dataSize, Endian.little);

    // Combine header + PCM data
    final wav = Uint8List(44 + dataSize);
    wav.setRange(0, 44, header.buffer.asUint8List());
    wav.setRange(44, 44 + dataSize, pcmData);

    return wav;
  }

  @override
  void dispose() {
    disconnect();
    _scanSubscription?.cancel();
    super.dispose();
  }
}
