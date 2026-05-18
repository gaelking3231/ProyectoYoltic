/// YOLTIC — BLE Bridge Application
/// 
/// Mobile bridge between ESP32-S3 smart glasses and Firebase.
/// Receives audio via BLE, uploads to Firebase Storage,
/// and displays real-time translations.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'services/ble_service.dart';
import 'services/firebase_service.dart';
import 'screens/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Configuración de Firebase unificada (Web/Android/iOS)
  await Firebase.initializeApp(
    options: const FirebaseOptions(
      apiKey: "AIzaSyCzphsTRNu3g5U7zUi9tNIR0GC3kzfPtRU",
      authDomain: "proyectoyoltic.firebaseapp.com",
      projectId: "proyectoyoltic",
      storageBucket: "proyectoyoltic.firebasestorage.app",
      messagingSenderId: "469382649324",
      appId: "1:469382649324:web:1b3b71a3f89d55936cdcc9",
      databaseURL: "https://proyectoyoltic-default-rtdb.firebaseio.com",
    ),
  );

  // Set status bar style
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );

  runApp(const YolticApp());
}

class YolticApp extends StatelessWidget {
  const YolticApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => BleService()),
        Provider(create: (_) => FirebaseService()),
      ],
      child: MaterialApp(
        title: 'YOLTIC',
        debugShowCheckedModeBanner: false,
        theme: _buildTheme(),
        home: const HomeScreen(),
      ),
    );
  }

  ThemeData _buildTheme() {
    const bgPrimary = Color(0xFF050505);
    const bgSecondary = Color(0x99141419); // 60% opacity for glassmorphism
    const bgTertiary = Color(0x661E1E23); // 40% opacity
    const accent = Color(0xFF10B981);
    const textPrimary = Color(0xFFFFFFFF);
    const textSecondary = Color(0xFF94A3B8);
    const borderColor = Color(0x14FFFFFF); // 8% white

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: 'Inter',
      scaffoldBackgroundColor: bgPrimary,
      colorScheme: const ColorScheme.dark(
        primary: accent,
        secondary: accent,
        surface: bgSecondary,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: textPrimary,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: bgPrimary,
        foregroundColor: textPrimary,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: textPrimary,
          letterSpacing: -0.5,
        ),
      ),
      cardTheme: CardThemeData(
        color: bgSecondary,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: borderColor),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: borderColor,
        thickness: 1,
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(
          fontFamily: 'Inter',
          fontSize: 28,
          fontWeight: FontWeight.w800,
          color: textPrimary,
          letterSpacing: -1,
        ),
        headlineMedium: TextStyle(
          fontFamily: 'Inter',
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: textPrimary,
          letterSpacing: -0.5,
        ),
        titleMedium: TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: textPrimary,
        ),
        bodyMedium: TextStyle(
          fontFamily: 'Inter',
          fontSize: 13,
          fontWeight: FontWeight.w400,
          color: textPrimary,
        ),
        bodySmall: TextStyle(
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: FontWeight.w400,
          color: textSecondary,
        ),
        labelSmall: TextStyle(
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: textSecondary,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}
