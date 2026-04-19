import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors as dc } from '../../design';

export default function InsightModal({ insightModal, onClose }) {
  return (
    <Modal visible={insightModal !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {insightModal && (
          <View style={styles.card}>
            <Text style={styles.title}>{insightModal.title}</Text>
            <Text style={styles.body}>{insightModal.body}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#151D2E', borderRadius: 24, padding: 24, width: '100%', borderWidth: 1, borderColor: dc.cardStroke },
  title: { fontSize: 20, fontWeight: '800', color: dc.textPrimary, marginBottom: 12 },
  body: { fontSize: 15, color: dc.textSecondary, lineHeight: 23 },
  closeBtn: { marginTop: 20, backgroundColor: dc.accentCyan, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '800', color: dc.bgTop },
});
