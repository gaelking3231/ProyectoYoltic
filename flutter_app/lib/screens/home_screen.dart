/// YOLTIC — Home Screen
/// 
/// Main mobile screen: BLE connection, live audio streaming indicator,
/// recent translations, and device controls.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/ble_service.dart';
import '../services/firebase_service.dart';
import '../components/glass_card.dart';
import 'translation_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  bool _isConferenceMode = false;
  bool _isRecordingSpanish = false;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // Initialize Firebase Auth and BLE callbacks
    _initServices();
  }

  void _initServices() async {
    final firebaseService = context.read<FirebaseService>();
    final bleService = context.read<BleService>();

    // Sign in anonymously for demo
    await firebaseService.signInAnonymously();

    // Set up BLE → Firebase pipeline
    bleService.onAudioComplete = (wavData) async {
      try {
        final conversationId = await firebaseService.uploadAudioAndCreateConversation(
          wavData: wavData,
          deviceId: bleService.connectedDevice?.remoteId.str ?? 'unknown',
          dialect: 'isthmus',
        );

        // Update device status
        if (bleService.connectedDevice != null) {
          await firebaseService.updateDeviceStatus(
            bleService.connectedDevice!.remoteId.str,
            'online',
          );
        }

        debugPrint('✅ Conversation created: $conversationId');
      } catch (e) {
        debugPrint('❌ Upload failed: $e');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Error al subir audio: $e'),
              backgroundColor: const Color(0xFFEF4444),
            ),
          );
        }
      }
    };

    bleService.onError = (message) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    };
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          color: Color(0xFF050505),
          image: DecorationImage(
            image: AssetImage('assets/images/bg_glow.png'), // Fallback if image doesn't exist, will just show bg color
            fit: BoxFit.cover,
            opacity: 0.1,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              _buildConnectionCard(),
              const SizedBox(height: 16),
              _buildConferenceToggle(),
              const SizedBox(height: 16),
              _buildStreamingIndicator(),
              const SizedBox(height: 24),
              Expanded(child: _buildTranslationsList()),
            ],
          ),
        ),
      ),
      floatingActionButton: _buildMicButton(),
    );
  }

  Widget _buildConferenceToggle() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        opacity: _isConferenceMode ? 0.15 : 0.05,
        border: Border.all(
          color: _isConferenceMode ? const Color(0xFF10B981) : Colors.white.withOpacity(0.1),
        ),
        child: Row(
          children: [
            Icon(
              _isConferenceMode ? Icons.record_voice_over : Icons.noise_control_off,
              color: _isConferenceMode ? const Color(0xFF10B981) : const Color(0xFF94A3B8),
              size: 20,
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'MODO CONFERENCIA',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                  ),
                  Text(
                    'Filtro de ruido avanzado activo',
                    style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                  ),
                ],
              ),
            ),
            Switch(
              value: _isConferenceMode,
              onChanged: (val) {
                setState(() => _isConferenceMode = val);
                // Sync with glasses via Firebase RTDB
                context.read<FirebaseService>().updateDeviceConfig(
                  context.read<BleService>().connectedDevice?.remoteId.str ?? 'unknown',
                  sensitivity: val ? 8 : 5,
                );
              },
              activeColor: const Color(0xFF10B981),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMicButton() {
    return FloatingActionButton.large(
      onPressed: () {
        setState(() => _isRecordingSpanish = !_isRecordingSpanish);
        // Logic for recording Spanish and sending to Cloud
        if (_isRecordingSpanish) {
          _startRecordingSpanish();
        } else {
          _stopRecordingSpanish();
        }
      },
      backgroundColor: _isRecordingSpanish ? const Color(0xFFEF4444) : const Color(0xFF10B981),
      child: Icon(
        _isRecordingSpanish ? Icons.stop : Icons.mic,
        color: Colors.white,
        size: 32,
      ),
    );
  }

  void _startRecordingSpanish() {
    // Implement local audio recording for Spanish
    debugPrint('🎙️ Recording Spanish...');
  }

  void _stopRecordingSpanish() {
    // Send to Cloud Function for Spanish -> Zapotec
    debugPrint('📤 Sending Spanish to Cloud...');
    // Simulated result update for demo
    context.read<FirebaseService>().sendTranslationToGlasses(
      context.read<BleService>().connectedDevice?.remoteId.str ?? 'unknown',
      "Padiuxi, ¿padi laa lii?", // "Hola, ¿cómo estás?" in Zapotec
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF10B981), Color(0xFF06b6d4)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(8),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF10B981).withOpacity(0.4),
                  blurRadius: 15,
                  spreadRadius: -2,
                ),
              ],
            ),
            child: const Center(
              child: Text(
                'Y',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'YOLTIC',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  letterSpacing: -0.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                'STUDIO · ZAPOTECO',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: const Color(0xFF94A3B8),
                  letterSpacing: 1.5,
                ),
              ),
            ],
          ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.notifications_outlined, size: 20, color: Color(0xFF94A3B8)),
          ),
        ],
      ),
    );
  }

  Widget _buildConnectionCard() {
    return Consumer<BleService>(
      builder: (context, ble, _) {
        final isConnected = ble.isConnected;
        final isScanning = ble.state == BleConnectionState.scanning;

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: GlassCard(
            opacity: isConnected ? 0.12 : 0.08,
            border: Border.all(
              color: isConnected
                  ? const Color(0xFF10B981).withOpacity(0.4)
                  : Colors.white.withOpacity(0.08),
            ),
            child: Row(
              children: [
                Stack(
                  alignment: Alignment.center,
                  children: [
                    if (isConnected || isScanning)
                      AnimatedBuilder(
                        animation: _pulseAnimation,
                        builder: (context, child) {
                          return Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: (isConnected
                                      ? const Color(0xFF10B981)
                                      : const Color(0xFFF59E0B))
                                  .withOpacity(0.2 * (1 - _pulseAnimation.value)),
                            ),
                          );
                        },
                      ),
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isConnected
                            ? const Color(0xFF10B981)
                            : isScanning
                                ? const Color(0xFFF59E0B)
                                : const Color(0xFF334155),
                        boxShadow: isConnected
                            ? [
                                BoxShadow(
                                  color: const Color(0xFF10B981).withOpacity(0.4),
                                  blurRadius: 8,
                                )
                              ]
                            : [],
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isConnected
                            ? ble.deviceName.toUpperCase()
                            : isScanning
                                ? 'BUSCANDO...'
                                : 'DESCONECTADO',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        isConnected
                            ? 'Conexión Estable (Cloud)'
                            : 'Toca para buscar Yoltic Glasses',
                        style: TextStyle(
                          fontSize: 12,
                          color: const Color(0xFF94A3B8),
                        ),
                      ),
                    ],
                  ),
                ),
                _buildConnectionButton(ble),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildConnectionButton(BleService ble) {
    if (ble.isConnected) {
      return Container(
        height: 32,
        child: TextButton(
          onPressed: () => ble.disconnect(),
          style: TextButton.styleFrom(
            foregroundColor: const Color(0xFFEF4444),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5),
          ),
          child: const Text('PARAR'),
        ),
      );
    }

    if (ble.state == BleConnectionState.scanning) {
      return const SizedBox(
        width: 16,
        height: 16,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: Color(0xFFF59E0B),
        ),
      );
    }

    return Container(
      height: 32,
      child: ElevatedButton(
        onPressed: () => ble.startScan(),
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF10B981),
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5),
        ),
        child: const Text('CONECTAR'),
      ),
    );
  }

  Widget _buildStreamingIndicator() {
    return Consumer<BleService>(
      builder: (context, ble, _) {
        if (!ble.isStreaming) return const SizedBox.shrink();

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFF8B5CF6).withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: const Color(0xFF8B5CF6).withOpacity(0.3),
              ),
            ),
            child: Row(
              children: [
                AnimatedBuilder(
                  animation: _pulseAnimation,
                  builder: (_, __) => Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color.lerp(
                        const Color(0xFF8B5CF6),
                        const Color(0xFFA78BFA),
                        _pulseAnimation.value,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                const Text(
                  'STREAMING',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                    color: Color(0xFFA78BFA),
                  ),
                ),
                const Spacer(),
                const Text(
                  'Recibiendo audio…',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF8B5CF6),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildTranslationsList() {
    final firebaseService = context.read<FirebaseService>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color(0xFFEF4444),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'TRADUCCIONES EN VIVO',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                  color: Color(0xFFEF4444),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: StreamBuilder<List<Map<String, dynamic>>>(
            stream: firebaseService.getConversationsStream(),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(
                  child: CircularProgressIndicator(
                    color: Color(0xFF10B981),
                    strokeWidth: 2,
                  ),
                );
              }

              final conversations = snapshot.data ?? [];

              if (conversations.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.translate,
                        size: 48,
                        color: Colors.white.withOpacity(0.15),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Sin traducciones aún',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withOpacity(0.3),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Conecta los lentes y comienza a hablar',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.white.withOpacity(0.2),
                        ),
                      ),
                    ],
                  ),
                );
              }

              return ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                physics: const BouncingScrollPhysics(),
                itemCount: conversations.length,
                itemBuilder: (context, index) {
                  final conv = conversations[index];
                  return _buildTranslationTile(conv);
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildTranslationTile(Map<String, dynamic> conv) {
    final status = 'completed'; // Python script only uploads completed translations for now
    final translatedText = conv['translation'] ?? '';
    final originalText = conv['stt_text'] ?? '';
    final source = conv['source'] ?? 'local';
    final latency = conv['latency_ms'] ?? 0;

    final statusColors = {
      'processing': const Color(0xFF3B82F6),
      'translating': const Color(0xFF8B5CF6),
      'completed': const Color(0xFF10B981),
      'error': const Color(0xFFEF4444),
    };

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => TranslationScreen(conversationId: conv['id']),
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        child: GlassCard(
          padding: const EdgeInsets.all(16),
          borderRadius: 12,
          opacity: 0.05,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: (statusColors[status] ?? Colors.grey).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(100),
                  ),
                  child: Text(
                    status.toUpperCase(),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                      color: statusColors[status] ?? Colors.grey,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF181C25),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: Colors.white.withOpacity(0.06)),
                  ),
                  child: Text(
                    source.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 10,
                      fontFamily: 'JetBrains Mono',
                      color: Color(0xFF64748B),
                    ),
                  ),
                ),
                const Spacer(),
                if (latency > 0)
                  Text(
                    '${latency}ms',
                    style: const TextStyle(
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono',
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF10B981),
                    ),
                  ),
              ],
            ),
            if (originalText.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                originalText,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w400,
                  color: Colors.white.withOpacity(0.5),
                  fontStyle: FontStyle.italic,
                  height: 1.5,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            if (translatedText.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                translatedText,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  height: 1.5,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            if (status == 'translating')
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: LinearProgressIndicator(
                  backgroundColor: Colors.white.withOpacity(0.06),
                  color: const Color(0xFF8B5CF6),
                  minHeight: 2,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

extension on double {
  String toFixed(int decimals) => toStringAsFixed(decimals);
}
