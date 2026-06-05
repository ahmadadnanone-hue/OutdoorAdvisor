import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors as dc } from '../../design';
import { useAuth } from '../../context/AuthContext';

// Native Apple button is optional (absent on web / Expo Go without the module).
let AppleAuthentication = null;
try {
  // eslint-disable-next-line global-require
  AppleAuthentication = require('expo-apple-authentication');
} catch {
  AppleAuthentication = null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN = 45; // seconds
// Sign in with Apple is hidden until the Supabase Apple provider is configured.
// Flip to true once the Apple Services ID + provider are set up (and ship a native build).
const APPLE_SIGNIN_ENABLED = true;

/**
 * Self-contained email/password + 6-digit-code auth flow.
 * States: signin | signup | verify | forgot | reset
 * Rendered inside the Settings "Account" card when the user is signed out.
 * On success, AuthProvider's auth-state listener flips the parent UI to signed-in.
 *
 * NOTE: helper views below are rendered as inline function calls — NOT as
 * nested <Component /> elements — so React keeps the TextInputs mounted across
 * renders and they don't lose focus on each keystroke.
 */
export default function AuthFlow() {
  const {
    signIn,
    signUp,
    verifyCode,
    resendCode,
    requestPasswordReset,
    confirmPasswordReset,
    signInWithApple,
    appleAuthAvailable,
  } = useAuth();

  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);

  const reset = useCallback((next) => {
    setError('');
    setInfo('');
    setCode('');
    setNewPassword('');
    if (next) setMode(next);
  }, []);

  // Resend cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    cooldownRef.current = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(cooldownRef.current);
  }, [cooldown]);

  const startCooldown = useCallback(() => setCooldown(RESEND_COOLDOWN), []);

  const guardEmail = useCallback(() => {
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address.');
      return false;
    }
    return true;
  }, [email]);

  const run = useCallback(async (fn) => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await fn();
    } catch (e) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  /* ---------- actions ---------- */
  const onSignIn = useCallback(() => {
    if (!guardEmail()) return;
    if (!password) { setError('Enter your password.'); return; }
    run(() => signIn({ email, password }));
  }, [guardEmail, password, run, signIn, email]);

  const onSignUp = useCallback(() => {
    if (!guardEmail()) return;
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    run(async () => {
      const res = await signUp({ email, password });
      if (res?.needsVerification) {
        startCooldown();
        setInfo(`We sent a 6-digit code to ${email.trim()}. Enter it below to finish.`);
        setMode('verify');
      }
    });
  }, [guardEmail, password, run, signUp, email, startCooldown]);

  const onVerify = useCallback(() => {
    if (code.trim().length < 6) { setError('Enter the 6-digit code from your email.'); return; }
    run(() => verifyCode({ email, token: code }));
  }, [code, run, verifyCode, email]);

  const onResend = useCallback(() => {
    if (cooldown > 0) return;
    run(async () => {
      await resendCode({ email });
      startCooldown();
      setInfo('A new code is on its way. Check your inbox (and spam).');
    });
  }, [cooldown, run, resendCode, email, startCooldown]);

  const onRequestReset = useCallback(() => {
    if (!guardEmail()) return;
    run(async () => {
      await requestPasswordReset({ email });
      startCooldown();
      setInfo(`We sent a 6-digit reset code to ${email.trim()}.`);
      setMode('reset');
    });
  }, [guardEmail, run, requestPasswordReset, email, startCooldown]);

  const onConfirmReset = useCallback(() => {
    if (code.trim().length < 6) { setError('Enter the 6-digit reset code.'); return; }
    if (newPassword.length < 6) { setError('New password must be at least 6 characters.'); return; }
    run(() => confirmPasswordReset({ email, token: code, newPassword }));
  }, [code, newPassword, run, confirmPasswordReset, email]);

  const onApple = useCallback(() => {
    run(() => signInWithApple());
  }, [run, signInWithApple]);

  /* ---------- inline render helpers (called, not mounted as components) ---------- */
  const feedback = () => (
    <>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}
    </>
  );

  const primaryButton = (label, onPress) => (
    <TouchableOpacity
      style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={busy}
    >
      {busy
        ? <ActivityIndicator size="small" color={dc.bgTop} />
        : <Text style={styles.primaryBtnText}>{label}</Text>}
    </TouchableOpacity>
  );

  const emailInput = () => (
    <TextInput
      value={email}
      onChangeText={setEmail}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="email-address"
      textContentType="emailAddress"
      placeholder="Email"
      placeholderTextColor={dc.textMuted}
      style={styles.input}
      editable={!busy}
    />
  );

  const codeInput = () => (
    <TextInput
      value={code}
      onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      placeholder="6-digit code"
      placeholderTextColor={dc.textMuted}
      style={[styles.input, styles.codeInput]}
      editable={!busy}
      maxLength={6}
    />
  );

  const resendLink = () => (
    <TouchableOpacity onPress={onResend} disabled={cooldown > 0 || busy}>
      <Text style={[styles.link, (cooldown > 0) && styles.linkMuted]}>
        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
      </Text>
    </TouchableOpacity>
  );

  const backToSignIn = () => (
    <TouchableOpacity onPress={() => reset('signin')}>
      <Text style={styles.linkSecondary}>Back to sign in</Text>
    </TouchableOpacity>
  );

  const appleBlock = () => {
    // Require the native module to actually be present in this build. This keeps a
    // production OTA (pushed to an older build without expo-apple-authentication)
    // from rendering a non-functional Apple button to live users.
    if (!APPLE_SIGNIN_ENABLED || Platform.OS !== 'ios' || !appleAuthAvailable
        || !AppleAuthentication?.AppleAuthenticationButton) return null;
    return (
      <>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>
        {AppleAuthentication?.AppleAuthenticationButton ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={12}
            style={styles.appleBtn}
            onPress={onApple}
          />
        ) : (
          <TouchableOpacity style={styles.appleFallback} onPress={onApple} activeOpacity={0.85} disabled={busy}>
            <Ionicons name="logo-apple" size={18} color="#000" />
            <Text style={styles.appleFallbackText}>Sign in with Apple</Text>
          </TouchableOpacity>
        )}
      </>
    );
  };

  /* ---------- per-mode views ---------- */
  if (mode === 'verify') {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.body}>Enter the 6-digit code we emailed to {email.trim()}.</Text>
        {codeInput()}
        {feedback()}
        {primaryButton('Verify & sign in', onVerify)}
        {resendLink()}
        {backToSignIn()}
      </View>
    );
  }

  if (mode === 'forgot') {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.body}>Enter your email and we’ll send a 6-digit reset code.</Text>
        {emailInput()}
        {feedback()}
        {primaryButton('Send reset code', onRequestReset)}
        {backToSignIn()}
      </View>
    );
  }

  if (mode === 'reset') {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.body}>Enter the code we emailed and choose a new password.</Text>
        {codeInput()}
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
          placeholder="New password"
          placeholderTextColor={dc.textMuted}
          style={styles.input}
          editable={!busy}
        />
        {feedback()}
        {primaryButton('Reset password', onConfirmReset)}
        {resendLink()}
        {backToSignIn()}
      </View>
    );
  }

  // signin / signup
  const isSignup = mode === 'signup';
  return (
    <View style={styles.panel}>
      <View style={styles.modeSwitch}>
        {[{ key: 'signin', label: 'Sign in' }, { key: 'signup', label: 'Create account' }].map((item) => {
          const active = mode === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.modeBtn, active && styles.modeBtnActive]}
              onPress={() => reset(item.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeBtnText, active && { color: dc.accentCyan }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {emailInput()}
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        textContentType={isSignup ? 'newPassword' : 'password'}
        placeholder={isSignup ? 'Create a password (min 6 chars)' : 'Password'}
        placeholderTextColor={dc.textMuted}
        style={styles.input}
        editable={!busy}
      />
      {feedback()}
      {primaryButton(isSignup ? 'Create account' : 'Sign in', isSignup ? onSignUp : onSignIn)}

      {isSignup ? null : (
        <TouchableOpacity onPress={() => reset('forgot')}>
          <Text style={styles.link}>Forgot password?</Text>
        </TouchableOpacity>
      )}

      {appleBlock()}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 10 },
  title: { fontSize: 17, fontWeight: '700', color: dc.textPrimary, letterSpacing: -0.2 },
  body: { fontSize: 13.5, color: dc.textSecondary, lineHeight: 19 },

  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: dc.cardGlass,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: dc.cardStroke,
  },
  modeBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  modeBtnActive: { backgroundColor: dc.cardGlassStrong },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: dc.textSecondary },

  input: {
    borderWidth: 1,
    borderColor: dc.cardStroke,
    backgroundColor: dc.cardGlass,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: dc.textPrimary,
  },
  codeInput: { letterSpacing: 6, fontSize: 18, fontWeight: '700', textAlign: 'center' },

  primaryBtn: {
    backgroundColor: dc.accentCyan,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 2,
  },
  primaryBtnText: { fontSize: 15.5, fontWeight: '700', color: dc.bgTop },

  link: { fontSize: 13.5, fontWeight: '600', color: dc.accentCyan, textAlign: 'center', paddingVertical: 6 },
  linkMuted: { color: dc.textMuted },
  linkSecondary: { fontSize: 13, color: dc.textMuted, textAlign: 'center', paddingVertical: 4 },

  error: { fontSize: 13, color: dc.accentRed, lineHeight: 18 },
  info: { fontSize: 13, color: dc.accentGreen, lineHeight: 18 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: dc.cardStroke },
  dividerText: { fontSize: 12, color: dc.textMuted },

  appleBtn: { height: 48, width: '100%' },
  appleFallback: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 13,
  },
  appleFallbackText: { fontSize: 15.5, fontWeight: '600', color: '#000' },
});
