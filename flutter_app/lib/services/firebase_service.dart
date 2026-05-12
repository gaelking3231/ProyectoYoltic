/// YOLTIC — Servicio Firebase
/// 
/// Integración Firebase para el puente móvil BLE.
/// Sube audio a Storage, crea documentos de conversación,
/// y escucha actualizaciones en tiempo real.

import 'dart:typed_data';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';

class FirebaseService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseStorage _storage = FirebaseStorage.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseDatabase _rtdb = FirebaseDatabase.instance;

  /// Usuario autenticado actual
  User? get currentUser => _auth.currentUser;
  String? get userId => _auth.currentUser?.uid;

  // ─── Subida de Audio ──────────────────────────────────────

  /// Sube audio WAV a Firebase Storage y crea un documento de conversación.
  /// Retorna el ID de la conversación.
  Future<String> uploadAudioAndCreateConversation({
    required Uint8List wavData,
    required String deviceId,
    required String dialect,
  }) async {
    if (userId == null) {
      throw Exception('Usuario no autenticado');
    }

    // Generar ID único de conversación
    final conversationId = _db.collection('conversaciones').doc().id;

    // 1. Subir audio a Storage
    final storagePath = 'audio/$userId/$conversationId.wav';
    final ref = _storage.ref().child(storagePath);

    await ref.putData(
      wavData,
      SettableMetadata(
        contentType: 'audio/wav',
        customMetadata: {
          'userId': userId!,
          'deviceId': deviceId,
          'dialect': dialect,
          'conversationId': conversationId,
        },
      ),
    );

    // 2. Crear documento de conversación en Firestore
    // Esto dispara la Cloud Function 'onConversationCreated'
    await _db.collection('conversaciones').doc(conversationId).set({
      'userId': userId,
      'deviceId': deviceId,
      'status': 'processing',
      'createdAt': FieldValue.serverTimestamp(),
      'audioUrl': storagePath,
      'audioDuration': 0,
      'originalText': '',
      'translatedText': '',
      'dialect': dialect,
      'confidence': 0,
      'metadata': {
        'sampleRate': 16000,
        'channels': 1,
        'processingTimeMs': 0,
      },
    });

    return conversationId;
  }

  // ─── Stream de Conversaciones en Tiempo Real ─────────────────

  /// Stream de todas las traducciones, ordenadas por tiempo
  Stream<List<Map<String, dynamic>>> getConversationsStream() {
    return _db
        .collection('translations')
        .orderBy('timestamp', descending: true)
        .limit(50)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => {'id': doc.id, ...doc.data()})
            .toList());
  }

  /// Stream de una sola traducción (seguimiento del progreso)
  Stream<Map<String, dynamic>?> getConversationStream(String conversationId) {
    return _db
        .collection('translations')
        .doc(conversationId)
        .snapshots()
        .map((snapshot) {
      if (snapshot.exists) {
        return {'id': snapshot.id, ...snapshot.data()!};
      }
      return null;
    });
  }

  // ─── Gestión de Dispositivos ───────────────────────────────

  /// Registrar o actualizar dispositivo en Firestore
  Future<void> registerDevice({
    required String deviceId,
    required String name,
    String type = 'esp32-s3-glasses',
    int volume = 50,
    String dialect = 'isthmus',
  }) async {
    if (userId == null) return;

    await _db.collection('dispositivos').doc(deviceId).set({
      'userId': userId,
      'name': name,
      'type': type,
      'status': 'online',
      'lastSeen': FieldValue.serverTimestamp(),
      'firmware': '1.0.0',
      'config': {
        'volume': volume,
        'dialect': dialect,
        'sampleRate': 16000,
        'sensitivity': 5,
      },
    }, SetOptions(merge: true));
  }

  /// Actualizar estado del dispositivo
  Future<void> updateDeviceStatus(String deviceId, String status) async {
    await _db.collection('dispositivos').doc(deviceId).update({
      'status': status,
      'lastSeen': FieldValue.serverTimestamp(),
    });
  }

  /// Actualizar configuración del dispositivo (volumen/dialecto)
  /// Esto dispara Cloud Function → sincronización RTDB → actualización ESP32
  Future<void> updateDeviceConfig(
    String deviceId, {
    int? volume,
    String? dialect,
    int? sensitivity,
  }) async {
    final updates = <String, dynamic>{};
    if (volume != null) updates['config.volume'] = volume;
    if (dialect != null) updates['config.dialect'] = dialect;
    if (sensitivity != null) updates['config.sensitivity'] = sensitivity;

    if (updates.isNotEmpty) {
      await _db.collection('dispositivos').doc(deviceId).update(updates);
    }
  }

  /// Envía un texto traducido directamente a los lentes para mostrar en el OLED
  Future<void> sendTranslationToGlasses(String deviceId, String text) async {
    // Usamos Realtime Database para latencia mínima
    final ref = _rtdb.ref('devices/$deviceId/last_translation');
    await ref.set(text);
  }

  /// Stream de dispositivos del usuario actual
  Stream<List<Map<String, dynamic>>> getDevicesStream() {
    if (userId == null) return const Stream.empty();

    return _db
        .collection('dispositivos')
        .where('userId', isEqualTo: userId)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => {'id': doc.id, ...doc.data()})
            .toList());
  }

  // ─── Autenticación ────────────────────────────────────────

  /// Iniciar sesión anónimamente para demo/prototipo
  Future<User?> signInAnonymously() async {
    final credential = await _auth.signInAnonymously();
    return credential.user;
  }

  /// Cerrar sesión
  Future<void> signOut() async {
    await _auth.signOut();
  }
}
