import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildApiUrl } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { AREAS } from '../../data/cities';
import { colors as dc, statusColor } from '../../design';
import Icon from '../Icon';
import { GlassCard } from '../glass';
import { ScreenGradient } from '../layout';

const HOME_PROMPTS = [
  'Can I have lunch outdoors tomorrow?',
  'Where can I play football right now?',
  'Where can I go camping in the mountains?',
  'Will it rain tomorrow?',
];

const TRAVEL_PROMPTS = [
  'Should I go to Murree tomorrow evening?',
  'Plan a trip to Skardu tomorrow.',
  'I am going to Multan now. Check the motorway.',
];

function distanceKm(a, b) {
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const lat1 = Number(a?.lat);
  const lon1 = Number(a?.lon);
  const lat2 = Number(b?.lat);
  const lon2 = Number(b?.lon);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function getPreciseLocationName(location, locationName) {
  const label = String(locationName || '').trim();
  const nearest = AREAS
    .map((area) => ({ ...area, distance: distanceKm(location, area) }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!nearest || nearest.distance > 12) return label;

  const alreadySpecific = label && !new RegExp(`^${nearest.city}$`, 'i').test(label) && !/^pakistan$/i.test(label);
  if (alreadySpecific) return label;
  return `${nearest.name}, ${nearest.city}`;
}

function compactWeatherSnapshot(snapshot) {
  if (!snapshot?.current) return null;
  return {
    source: snapshot.source,
    updatedAt: snapshot.updatedAt,
    isUsingCache: Boolean(snapshot.isUsingCache),
    current: snapshot.current,
    hourly: (snapshot.hourly || []).slice(0, 72),
    daily: (snapshot.daily || []).slice(0, 10),
  };
}

export function AskOutdoorAdvisorCard({ onPress, compact = false }) {
  return (
    <GlassCard
      onPress={onPress}
      tintColor={dc.infoGlass}
      borderColor={dc.infoStroke}
      contentStyle={[styles.entryContent, compact && styles.entryContentCompact]}
    >
      <View style={styles.entryIcon}>
        <Icon name="sparkles-outline" size={20} color={dc.accentCyan} />
      </View>
      <View style={styles.entryCopy}>
        <View style={styles.entryTitleRow}>
          <Text style={styles.entryTitle}>Ask OutdoorAdvisor</Text>
          <Text style={styles.premiumLabel}>PREMIUM</Text>
        </View>
        <Text style={styles.entryBody}>
          Ask about weather, outdoor timing, nearby places, or a travel route.
        </Text>
      </View>
      <Icon name="chevron-forward" size={18} color={dc.textMuted} />
    </GlassCard>
  );
}

export default function AskOutdoorAdvisor({
  visible,
  onClose,
  location,
  locationName,
  weatherSnapshot,
  context = 'home',
}) {
  const insets = useSafeAreaInsets();
  const { isPremium, isSignedIn, session } = useAuth();
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const prompts = context === 'travel' ? TRAVEL_PROMPTS : HOME_PROMPTS;

  const sourceRows = useMemo(() => {
    const status = result?.evidence?.sourceStatus || {};
    const labels = { forecast: 'Forecast', airQuality: 'Air quality', PMD: 'PMD', NDMA: 'NDMA', NHMP: 'NHMP', GoogleRoute: 'Google route', places: 'Places' };
    return Object.entries(status)
      .filter(([, value]) => value !== 'not requested')
      .map(([key, value]) => ({ key, label: labels[key] || key, value }));
  }, [result]);

  const ask = async (preset) => {
    const nextQuestion = String(preset || question).trim();
    if (!nextQuestion || loading) return;
    const conversationContext = result?.evidence?.context || null;
    setQuestion(nextQuestion);
    setLoading(true);
    setError('');
    setResult(null);

    try {
      if (!isPremium || !isSignedIn || !session?.access_token) {
        throw new Error('Sign in with your premium account to use Ask OutdoorAdvisor.');
      }
      const response = await fetch(buildApiUrl('/api/ai/briefing'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          kind: 'ask',
          question: nextQuestion,
          lat: location?.lat,
          lon: location?.lon,
          locationName,
          preciseLocationName: getPreciseLocationName(location, locationName),
          localWeatherSnapshot: compactWeatherSnapshot(weatherSnapshot),
          conversationContext,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Ask request failed (${response.status}).`);
      setResult(payload);
    } catch (askError) {
      setError(askError.message || 'Ask OutdoorAdvisor is unavailable right now.');
    } finally {
      setLoading(false);
    }
  };

  const tone = statusColor(result?.verdict || 'info');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <ScreenGradient>
        <KeyboardAvoidingView
          style={styles.modalSafe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.modalInner, {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16),
            paddingLeft: Math.max(insets.left + 16, 20),
            paddingRight: Math.max(insets.right + 16, 20),
          }]}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>PREMIUM · LIVE EVIDENCE</Text>
                <Text style={styles.title}>Ask OutdoorAdvisor</Text>
                <Text style={styles.subtitle}>Weather, outdoor plans, nearby places, and route checks.</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.75}>
                <Icon name="close" size={20} color={dc.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.promptRow}>
                {prompts.map((prompt) => (
                  <TouchableOpacity key={prompt} style={styles.promptChip} onPress={() => ask(prompt)} activeOpacity={0.76}>
                    <Text style={styles.promptText}>{prompt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {loading ? (
                <GlassCard contentStyle={styles.loadingCard}>
                  <ActivityIndicator color={dc.accentCyan} />
                  <Text style={styles.loadingTitle}>Checking live evidence…</Text>
                  <Text style={styles.loadingBody}>Forecasts and relevant official sources are being compared.</Text>
                </GlassCard>
              ) : null}

              {!!error && (
                <GlassCard tintColor={dc.dangerGlass} borderColor={dc.dangerStroke} contentStyle={styles.resultContent}>
                  <Text style={styles.errorText}>{error}</Text>
                </GlassCard>
              )}

              {!!result && (
                <GlassCard tintColor={tone.tint} borderColor={tone.stroke} contentStyle={styles.resultContent}>
                  <View style={styles.verdictRow}>
                    <View style={[styles.verdictDot, { backgroundColor: tone.fg }]} />
                    <Text style={[styles.verdict, { color: tone.fg }]}>{String(result.verdict || 'plan').toUpperCase()}</Text>
                    <Text style={styles.freshness}>checked just now</Text>
                  </View>
                  <Text selectable style={styles.resultTitle}>{result.headline}</Text>
                  <Text selectable style={styles.resultAnswer}>{result.answer}</Text>
                  {(result.bullets || []).map((bullet, index) => (
                    <View key={`${bullet}-${index}`} style={styles.bulletRow}>
                      <View style={[styles.bullet, { backgroundColor: tone.fg }]} />
                      <Text selectable style={styles.bulletText}>{bullet}</Text>
                    </View>
                  ))}
                  {(result.sections || []).map((section) => (
                    <View key={section.title} style={styles.resultSection}>
                      <Text style={styles.resultSectionTitle}>{section.title}</Text>
                      {(section.items || []).map((item, index) => (
                        <Text key={`${section.title}-${index}`} selectable style={styles.resultSectionItem}>
                          {item}
                        </Text>
                      ))}
                    </View>
                  ))}
                  {sourceRows.length > 0 && (
                    <View style={styles.sources}>
                      <Text style={styles.sourcesLabel}>SOURCES CHECKED</Text>
                      <View style={styles.sourceRow}>
                        {sourceRows.map((source) => (
                          <View key={source.key} style={styles.sourcePill}>
                            <View style={[styles.sourceDot, {
                              backgroundColor: source.value === 'live' || source.value === 'cached' ? dc.accentGreen : source.value === 'stale' ? dc.accentYellow : dc.textMuted,
                            }]} />
                            <Text style={styles.sourceText}>{source.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </GlassCard>
              )}
            </ScrollView>

            <View style={styles.composer}>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                placeholder="Ask about an outdoor plan or route…"
                placeholderTextColor={dc.textMuted}
                style={styles.input}
                maxLength={500}
                multiline
                editable={!loading}
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={() => ask()}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!question.trim() || loading) && styles.sendButtonDisabled]}
                disabled={!question.trim() || loading}
                onPress={() => ask()}
                activeOpacity={0.8}
              >
                {loading ? <ActivityIndicator size="small" color={dc.bgTop} /> : <Icon name="arrow-up" size={19} color={dc.bgTop} />}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ScreenGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  entryContent: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  entryContentCompact: { paddingVertical: 14 },
  entryIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: dc.accentCyanSoftBg },
  entryCopy: { flex: 1, gap: 4 },
  entryTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  entryTitle: { fontSize: 15, fontWeight: '800', color: dc.textPrimary },
  premiumLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.1, color: dc.premiumGold },
  entryBody: { fontSize: 12, lineHeight: 17, color: dc.textSecondary },
  modalSafe: { flex: 1 },
  modalInner: { flex: 1, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, gap: 4 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: dc.premiumGold },
  title: { fontSize: 28, fontWeight: '800', color: dc.textPrimary },
  subtitle: { fontSize: 13, lineHeight: 18, color: dc.textSecondary },
  closeButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: dc.cardGlassStrong, borderWidth: 1, borderColor: dc.cardStroke },
  scroll: { flex: 1 },
  scrollContent: { gap: 14, paddingBottom: 16 },
  promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  promptChip: { maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: dc.cardGlassStrong, borderWidth: 1, borderColor: dc.cardStrokeSoft },
  promptText: { fontSize: 12, fontWeight: '600', color: dc.textSecondary },
  loadingCard: { padding: 20, alignItems: 'center', gap: 8 },
  loadingTitle: { fontSize: 15, fontWeight: '700', color: dc.textPrimary },
  loadingBody: { fontSize: 12, lineHeight: 17, textAlign: 'center', color: dc.textSecondary },
  resultContent: { padding: 18, gap: 10 },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  verdictDot: { width: 8, height: 8, borderRadius: 4 },
  verdict: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  freshness: { marginLeft: 'auto', fontSize: 10, color: dc.textMuted },
  resultTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: dc.textPrimary },
  resultAnswer: { fontSize: 14, lineHeight: 21, color: dc.textSecondary },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 19, color: dc.textPrimary },
  resultSection: { gap: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: dc.cardStrokeSoft },
  resultSectionTitle: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: dc.textMuted },
  resultSectionItem: { fontSize: 12, lineHeight: 18, color: dc.textSecondary },
  sources: { gap: 8, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: dc.cardStrokeSoft },
  sourcesLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: dc.textMuted },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  sourcePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, backgroundColor: dc.cardGlassStrong },
  sourceDot: { width: 5, height: 5, borderRadius: 3 },
  sourceText: { fontSize: 10, fontWeight: '700', color: dc.textSecondary },
  errorText: { fontSize: 13, lineHeight: 19, color: dc.accentRed },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 8, borderRadius: 20, backgroundColor: dc.cardGlassStrong, borderWidth: 1, borderColor: dc.cardStroke },
  input: { flex: 1, minHeight: 40, maxHeight: 100, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, lineHeight: 19, color: dc.textPrimary },
  sendButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: dc.accentCyan },
  sendButtonDisabled: { opacity: 0.4 },
});
