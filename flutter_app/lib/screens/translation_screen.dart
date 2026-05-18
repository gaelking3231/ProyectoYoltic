/// YOLTIC — Translation Detail Screen
/// 
/// Shows full translation details for a specific conversation,
/// including original text, translated text, confidence score,
/// audio playback, and processing metadata.

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../components/glass_card.dart';

class TranslationScreen extends StatelessWidget {
  final String conversationId;

  const TranslationScreen({super.key, required this.conversationId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050505),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('DETALLES'),
        titleTextStyle: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.5,
          color: Colors.white,
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      extendBodyBehindAppBar: true,
      body: StreamBuilder<DocumentSnapshot>(
        stream: FirebaseFirestore.instance
            .collection('translations')
            .doc(conversationId)
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(
                color: Color(0xFF10B981),
                strokeWidth: 2,
              ),
            );
          }

          if (!snapshot.hasData || !snapshot.data!.exists) {
            return const Center(
              child: Text(
                'Conversación no encontrada',
                style: TextStyle(color: Color(0xFF64748B)),
              ),
            );
          }

          final data = snapshot.data!.data() as Map<String, dynamic>;
          return _buildContent(context, data);
        },
      ),
    );
  }

  Widget _buildContent(BuildContext context, Map<String, dynamic> data) {
    final status = 'completed'; 
    final originalText = data['stt_text'] ?? '';
    final translatedText = data['translation'] ?? '';
    final source = data['source'] ?? 'local';
    final processingTimeMs = data['latency_ms'] ?? 0;
    final audioDuration = 0.0; // Omitted for now, we don't save this field.
    final error = data['error'];

    final dialectLabels = {
      'valley': 'Zapoteco del Valle',
      'isthmus': 'Zapoteco del Istmo',
      'sierra_norte': 'Zapoteco Sierra Norte',
      'sierra_sur': 'Zapoteco Sierra Sur',
    };

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: Color(0xFF050505),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 110, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status Badge
            _buildStatusBadge(status),
            const SizedBox(height: 24),

            // Audio Section
            GlassCard(
              opacity: 0.1,
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          const Color(0xFF10B981).withOpacity(0.2),
                          const Color(0xFF06b6d4).withOpacity(0.2),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: const Color(0xFF10B981).withOpacity(0.3),
                      ),
                    ),
                    child: const Icon(
                      Icons.play_arrow_rounded,
                      color: Color(0xFF10B981),
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'AUDIO ORIGINAL',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                          ),
                        ),
                        Text(
                          '16kHz · Mono · WAV',
                          style: TextStyle(
                            fontSize: 12,
                            color: const Color(0xFF94A3B8),
                            fontFamily: 'JetBrains Mono',
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Original Text
            if (originalText.isNotEmpty) ...[
              _buildSectionLabel('TEXTO ORIGINAL (ZAPOTECO)'),
              const SizedBox(height: 12),
              GlassCard(
                opacity: 0.05,
                padding: const EdgeInsets.all(20),
                child: Text(
                  originalText,
                  style: const TextStyle(
                    fontSize: 16,
                    fontStyle: FontStyle.italic,
                    color: Color(0xFF94A3B8),
                    height: 1.6,
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],

            // Translation
            if (translatedText.isNotEmpty) ...[
              _buildSectionLabel('TRADUCCIÓN (ESPAÑOL)'),
              const SizedBox(height: 12),
              GlassCard(
                opacity: 0.08,
                padding: const EdgeInsets.all(20),
                border: Border.all(
                  color: const Color(0xFF10B981).withOpacity(0.3),
                ),
                child: Text(
                  translatedText,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    height: 1.6,
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],

          // Error
          if (error != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: const Color(0xFFEF4444).withOpacity(0.3),
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.error_outline,
                    color: Color(0xFFEF4444),
                    size: 20,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      error,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFFF87171),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

            // Metadata Grid
            _buildSectionLabel('METADATOS DEL MOTOR'),
            const SizedBox(height: 16),
            _buildMetadataGrid(
              source: source,
              processingTimeMs: processingTimeMs,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    final statusConfig = {
      'processing': (const Color(0xFF3B82F6), 'Procesando'),
      'translating': (const Color(0xFF8B5CF6), 'Traduciendo…'),
      'completed': (const Color(0xFF10B981), 'Completado'),
      'error': (const Color(0xFFEF4444), 'Error'),
    };

    final config = statusConfig[status] ?? (Colors.grey, status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: config.$1.withOpacity(0.15),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: config.$1.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: config.$1,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            config.$2,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: config.$1,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w800,
        letterSpacing: 1.2,
        color: Color(0xFF64748B),
      ),
    );
  }

  Widget _buildMetadataGrid({
    required String source,
    required int processingTimeMs,
  }) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _metadataChip('🧠', 'Motor', source.toUpperCase()),
        _metadataChip('⚡', 'Latencia', '${processingTimeMs}ms'),
      ],
    );
  }

  Widget _metadataChip(String icon, String label, String value) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      borderRadius: 12,
      opacity: 0.05,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$icon ${label.toUpperCase()}',
            style: const TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              color: Color(0xFF64748B),
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              fontFamily: 'JetBrains Mono',
            ),
          ),
        ],
      ),
    );
  }
}
