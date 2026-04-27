/**
 * AboutTab — full App Store-compliant About section.
 *
 * Covers: app info, mission, data sources, weather disclaimer,
 * privacy summary, terms of use, open-source attributions, contact.
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Linking, StyleSheet, Modal, Pressable,
} from 'react-native';
import Constants from 'expo-constants';
import { GlassCard } from '../glass';
import Icon from '../Icon';
import { colors as dc } from '../../design';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const BUILD       = Constants.expoConfig?.ios?.buildNumber ?? '1';

// ─── Legal text bodies ────────────────────────────────────────────────────────
const PRIVACY_TEXT = `OutdoorAdvisor is built with your privacy as a default, not an afterthought.

WHAT WE COLLECT
• Location — used only to fetch weather, air quality, and pollen data for your area. It is never stored on our servers, never sold, and never shared with third parties.
• Notification preferences — stored locally on your device using AsyncStorage.
• No account is required to use the app.

WHAT WE DO NOT COLLECT
• We do not collect names, email addresses, or any personally identifiable information unless you voluntarily sign in.
• We do not use advertising identifiers (IDFA).
• We do not run analytics that profile individual users.
• We do not sell data. Ever.

THIRD-PARTY SERVICES
Weather data is fetched from Apple WeatherKit and Open-Meteo — both are governed by their own privacy policies. Air quality data is sourced from AQICN. Road advisories are sourced from NHMP and PMD public feeds. None of these services receive your precise GPS coordinates through our app beyond what is necessary to serve local data.

CHILDREN
OutdoorAdvisor is not directed at children under 13 and does not knowingly collect information from them.

CHANGES
If we materially change how we handle your data, we will update this text and bump the app version.

Contact: privacy@outdooradvisor.app`;

const TERMS_TEXT = `These Terms of Use govern your use of the OutdoorAdvisor iOS application.

1. ACCEPTANCE
By downloading or using OutdoorAdvisor you agree to these terms. If you do not agree, please delete the app.

2. LICENCE
OutdoorAdvisor grants you a personal, non-transferable, non-exclusive licence to use the app on Apple devices you own or control, subject to the Apple Media Services Terms and Conditions.

3. WEATHER DATA — IMPORTANT DISCLAIMER
All weather, air quality, pollen, and road-condition data displayed in OutdoorAdvisor is provided for general informational purposes only. It is sourced from third-party providers (Apple WeatherKit, Open-Meteo, AQICN, NHMP, PMD) and may be delayed, inaccurate, or unavailable without notice.

DO NOT use OutdoorAdvisor to make safety-critical decisions — including but not limited to: emergency evacuations, mountaineering, aviation, flood or landslide risk assessment, or any situation where an error could result in personal injury or death. Always consult official government emergency services and meteorological authorities for such decisions.

4. LIMITATION OF LIABILITY
To the maximum extent permitted by applicable law, OutdoorAdvisor and its developer shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of, or inability to use, the application or its data.

5. CHANGES TO THE APP
We may update, modify, or discontinue the app or any feature at any time without notice.

6. GOVERNING LAW
These terms are governed by the laws of Pakistan, without regard to conflict-of-law provisions.

7. CONTACT
Questions about these terms: support@outdooradvisor.app`;

const DISCLAIMER_TEXT = `Weather forecasts are probabilistic estimates, not guarantees. Conditions — especially in mountainous regions like Murree, Swat, and Gilgit-Baltistan — can change rapidly and unpredictably.

ROAD CONDITIONS
NHMP and PMD advisory data is sourced from official public feeds and reflects the last available report. Road closures, diversions, and hazards may not be reflected immediately. Always call NHMP (1122 / motorway police) or check local radio before major highway travel.

AIR QUALITY
AQI values are measured at the nearest available monitoring station and may not reflect hyperlocal air quality at your exact location.

POLLEN
Pollen level estimates are based on seasonal models and nearby sensors. Individuals with severe allergies should consult a physician and not rely solely on app data.

OUTDOOR ACTIVITIES
The "Outdoor Decision" card gives a general guidance signal — not a medical or safety advisory. Use your own judgement and consult professionals for high-risk activities.`;

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <Icon name={icon} size={16} color={dc.accentCyan} />
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

function InfoRow({ label, value, onPress, iconName }) {
  return (
    <TouchableOpacity
      style={styles.infoRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoRight}>
        <Text style={[styles.infoValue, onPress && { color: dc.accentCyan }]}>{value}</Text>
        {iconName && <Icon name={iconName} size={14} color={dc.accentCyan} style={{ marginLeft: 4 }} />}
      </View>
    </TouchableOpacity>
  );
}

function SourceBadge({ name, desc, url, accent }) {
  return (
    <TouchableOpacity
      style={[styles.sourceBadge, { borderColor: accent + '55' }]}
      onPress={() => url && Linking.openURL(url)}
      activeOpacity={0.75}
    >
      <View style={[styles.sourceDot, { backgroundColor: accent }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.sourceName, { color: accent }]}>{name}</Text>
        <Text style={styles.sourceDesc}>{desc}</Text>
      </View>
      {url && <Icon name="open-outline" size={13} color={dc.textMuted} />}
    </TouchableOpacity>
  );
}

function LegalModal({ title, body, visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalBody}>{body}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.modalClose} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.modalCloseText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AboutTab() {
  const [modal, setModal] = useState(null); // { title, body }

  const open = (title, body) => setModal({ title, body });
  const close = () => setModal(null);

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <GlassCard strong style={styles.hero} contentStyle={styles.heroContent}>
          <Text style={styles.heroEmoji}>🌬️</Text>
          <Text style={styles.heroName}>OutdoorAdvisor</Text>
          <Text style={styles.heroVersion}>Version {APP_VERSION} · Build {BUILD}</Text>
          <Text style={styles.heroTagline}>
            Your calm, practical guide to outdoor conditions across Pakistan.
          </Text>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Icon name="shield-checkmark-outline" size={12} color={dc.accentGreen} />
              <Text style={[styles.heroBadgeText, { color: dc.accentGreen }]}>Privacy-first</Text>
            </View>
            <View style={styles.heroBadge}>
              <Icon name="phone-portrait-outline" size={12} color={dc.accentCyan} />
              <Text style={[styles.heroBadgeText, { color: dc.accentCyan }]}>iOS only</Text>
            </View>
            <View style={styles.heroBadge}>
              <Icon name="flag-outline" size={12} color={dc.accentOrange} />
              <Text style={[styles.heroBadgeText, { color: dc.accentOrange }]}>Made for Pakistan</Text>
            </View>
          </View>
        </GlassCard>

        {/* ── Mission ──────────────────────────────────────────────── */}
        <GlassCard style={styles.card} contentStyle={styles.cardContent}>
          <SectionHeader icon="information-circle-outline" title="About" />
          <Text style={styles.body}>
            OutdoorAdvisor gives you a clear, calm read on the conditions outside — whether you're planning a morning run, checking if it's safe to drive the M2, or deciding whether to take the kids to Murree this weekend.
          </Text>
          <Text style={[styles.body, { marginTop: 10 }]}>
            Built in Pakistan for Pakistan, with a strong focus on practical local context: air quality, pollen, road advisories, and weather — all in one place.
          </Text>
        </GlassCard>

        {/* ── Weather Disclaimer ────────────────────────────────────── */}
        <GlassCard style={styles.card} contentStyle={styles.cardContent}>
          <SectionHeader icon="warning-outline" title="Weather Data Disclaimer" />
          <Text style={[styles.body, { color: dc.accentYellow, fontWeight: '600', marginBottom: 8 }]}>
            Not for safety-critical decisions.
          </Text>
          <Text style={styles.body}>
            All weather, air quality, and road data is provided for general informational purposes only. Forecasts can be wrong. Conditions change rapidly — especially in mountain regions.
          </Text>
          <Text style={[styles.body, { marginTop: 8 }]}>
            For emergencies, evacuations, or high-risk outdoor activities always consult official government sources and emergency services.
          </Text>
          <TouchableOpacity
            style={styles.readMoreBtn}
            onPress={() => open('Full Disclaimer', DISCLAIMER_TEXT)}
            activeOpacity={0.75}
          >
            <Text style={styles.readMoreText}>Read full disclaimer</Text>
            <Icon name="chevron-forward" size={14} color={dc.accentCyan} />
          </TouchableOpacity>
        </GlassCard>

        {/* ── Data Sources ─────────────────────────────────────────── */}
        <GlassCard style={styles.card} contentStyle={styles.cardContent}>
          <SectionHeader icon="cloud-download-outline" title="Data Sources" />
          <SourceBadge
            name="Apple WeatherKit"
            desc="Current conditions, hourly & daily forecast, weather alerts"
            url="https://developer.apple.com/weatherkit/"
            accent={dc.accentCyan}
          />
          <SourceBadge
            name="Open-Meteo"
            desc="Open-source weather API — fallback when WeatherKit is unavailable"
            url="https://open-meteo.com"
            accent={dc.accentBlue}
          />
          <SourceBadge
            name="AQICN / World Air Quality Index"
            desc="Air quality index (AQI) and PM2.5 measurements"
            url="https://aqicn.org"
            accent={dc.accentGreen}
          />
          <SourceBadge
            name="NHMP — National Highway & Motorway Police"
            desc="Motorway closures, road advisories, and travel alerts"
            url="https://nhmp.gov.pk"
            accent={dc.accentOrange}
          />
          <SourceBadge
            name="PMD — Pakistan Meteorological Department"
            desc="Official Pakistan weather forecasts and severe weather advisories"
            url="https://pmd.gov.pk"
            accent={dc.accentYellow}
          />
        </GlassCard>

        {/* ── Privacy & Legal ───────────────────────────────────────── */}
        <GlassCard style={styles.card} contentStyle={styles.cardContent}>
          <SectionHeader icon="shield-outline" title="Privacy & Legal" />
          <InfoRow
            label="Privacy Policy"
            value="Read"
            onPress={() => open('Privacy Policy', PRIVACY_TEXT)}
            iconName="chevron-forward"
          />
          <View style={styles.divider} />
          <InfoRow
            label="Terms of Use"
            value="Read"
            onPress={() => open('Terms of Use', TERMS_TEXT)}
            iconName="chevron-forward"
          />
          <View style={styles.divider} />
          <InfoRow
            label="Data collected"
            value="Location only (on-device)"
          />
          <View style={styles.divider} />
          <InfoRow
            label="Advertising identifiers"
            value="None used"
          />
          <View style={styles.divider} />
          <InfoRow
            label="Data sold to third parties"
            value="Never"
          />
        </GlassCard>

        {/* ── Open Source ───────────────────────────────────────────── */}
        <GlassCard style={styles.card} contentStyle={styles.cardContent}>
          <SectionHeader icon="code-slash-outline" title="Open Source" />
          <Text style={[styles.body, { marginBottom: 12 }]}>
            OutdoorAdvisor is built on the shoulders of these excellent open-source projects:
          </Text>
          {[
            { name: 'React Native',            url: 'https://reactnative.dev' },
            { name: 'Expo',                    url: 'https://expo.dev' },
            { name: 'React Navigation',        url: 'https://reactnavigation.org' },
            { name: 'React Native Reanimated', url: 'https://docs.swmansion.com/react-native-reanimated/' },
            { name: 'expo-blur',               url: 'https://docs.expo.dev/versions/latest/sdk/blur-view/' },
            { name: '@noble/curves',           url: 'https://github.com/paulmillr/noble-curves' },
            { name: 'Supabase',                url: 'https://supabase.com' },
          ].map(({ name, url }) => (
            <TouchableOpacity
              key={name}
              style={styles.ossRow}
              onPress={() => Linking.openURL(url)}
              activeOpacity={0.7}
            >
              <Text style={styles.ossName}>{name}</Text>
              <Icon name="open-outline" size={13} color={dc.textMuted} />
            </TouchableOpacity>
          ))}
        </GlassCard>

        {/* ── Contact & Feedback ────────────────────────────────────── */}
        <GlassCard style={styles.card} contentStyle={styles.cardContent}>
          <SectionHeader icon="mail-outline" title="Contact" />
          <InfoRow
            label="Website"
            value="outdooradvisor.app"
            onPress={() => Linking.openURL('https://outdooradvisor.app')}
            iconName="open-outline"
          />
          <View style={styles.divider} />
          <InfoRow
            label="Support"
            value="support@outdooradvisor.app"
            onPress={() => Linking.openURL('mailto:support@outdooradvisor.app?subject=OutdoorAdvisor%20Support')}
            iconName="open-outline"
          />
          <View style={styles.divider} />
          <InfoRow
            label="Feedback & bugs"
            value="feedback@outdooradvisor.app"
            onPress={() => Linking.openURL('mailto:feedback@outdooradvisor.app?subject=OutdoorAdvisor%20Feedback')}
            iconName="open-outline"
          />
          <View style={styles.divider} />
          <InfoRow
            label="Developer"
            value="Ahmed Adnan"
          />
          <View style={styles.divider} />
          <InfoRow
            label="Country"
            value="Pakistan 🇵🇰"
          />
        </GlassCard>

        {/* ── App Store legal footer ────────────────────────────────── */}
        <Text style={styles.footer}>
          © {new Date().getFullYear()} Ahmed Adnan. All rights reserved.{'\n'}
          OutdoorAdvisor is an independent app not affiliated with Apple Inc.,
          NHMP, PMD, or any government body.{'\n\n'}
          Weather data accuracy is not guaranteed. Not for emergency use.
        </Text>
      </ScrollView>

      {/* Legal full-text modal */}
      <LegalModal
        title={modal?.title}
        body={modal?.body}
        visible={modal !== null}
        onClose={close}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { gap: 12, padding: 20, paddingBottom: 40 },

  // Hero
  hero:        { width: '100%' },
  heroContent: { alignItems: 'center', padding: 24, gap: 6 },
  heroEmoji:   { fontSize: 56, marginBottom: 4 },
  heroName:    { fontSize: 26, fontWeight: '800', color: dc.textPrimary },
  heroVersion: { fontSize: 13, color: dc.textMuted, fontWeight: '500' },
  heroTagline: { fontSize: 14, color: dc.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: 4 },
  heroBadgeRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  heroBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: dc.cardGlass, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: dc.cardStrokeSoft },
  heroBadgeText: { fontSize: 11, fontWeight: '700' },

  // Cards
  card:        { width: '100%' },
  cardContent: { padding: 18, gap: 0 },

  // Section header
  sectionHeader:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  sectionHeaderText: { fontSize: 13, fontWeight: '800', color: dc.accentCyan, letterSpacing: 1.2, textTransform: 'uppercase' },

  // Body text
  body: { fontSize: 14, color: dc.textSecondary, lineHeight: 22 },

  // Info rows
  infoRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  infoLabel:  { fontSize: 14, color: dc.textPrimary, fontWeight: '500' },
  infoRight:  { flexDirection: 'row', alignItems: 'center' },
  infoValue:  { fontSize: 14, color: dc.textSecondary },
  divider:    { height: 1, backgroundColor: dc.cardStrokeSoft },

  // Read more
  readMoreBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, alignSelf: 'flex-start' },
  readMoreText: { fontSize: 13, fontWeight: '700', color: dc.accentCyan },

  // Data sources
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: dc.cardStrokeSoft },
  sourceDot:   { width: 8, height: 8, borderRadius: 4 },
  sourceName:  { fontSize: 13, fontWeight: '700' },
  sourceDesc:  { fontSize: 12, color: dc.textMuted, marginTop: 1 },

  // OSS
  ossRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: dc.cardStrokeSoft },
  ossName: { fontSize: 14, color: dc.textPrimary },

  // Legal modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: '#151D2E', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', padding: 20 },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: dc.cardStroke, alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: dc.textPrimary, marginBottom: 16 },
  modalScroll:  { flexGrow: 0 },
  modalBody:    { fontSize: 14, color: dc.textSecondary, lineHeight: 23, paddingBottom: 16 },
  modalClose:   { backgroundColor: dc.accentCyan, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  modalCloseText: { fontSize: 15, fontWeight: '800', color: dc.bgTop },

  // Footer
  footer: { fontSize: 11, color: dc.textMuted, textAlign: 'center', lineHeight: 17, paddingHorizontal: 8 },
});
