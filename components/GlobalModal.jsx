// GlobalModal.js
import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { closeModal } from '../state/slices/modal.slice';
import { useTheme } from 'react-native-paper';

const GlobalModal = () => {
  const isVisible = useSelector((state) => state.modal.isVisible);
  const content = useSelector((state) => state.modal.content);
  const dispatch = useDispatch();

  const { colors, dark } = useTheme();

  return (
    <Modal
      transparent={true}
      visible={isVisible}
      animationType="slide"
      onRequestClose={() => dispatch(closeModal())}
    >
      <View style={[styles.modalBackground, {backgroundColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.5)'}]}>
        <View style={[styles.modalContainer, {backgroundColor: colors.background}]}>
          {/* Close Button */}
          <View style={styles.closeButton}>
            <TouchableOpacity
                onPress={() => dispatch(closeModal())}
            >
                <Text style={[styles.closeButtonText, {color: colors.text}]}>✕</Text>
            </TouchableOpacity>
          </View>
          
          {/* Modal Content */}
          {content || null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContainer: {
    width: '100%',
    padding:20,
    paddingTop:0,
    borderRadius: 10,
    position: 'relative',
  },
  closeButton: {
    zIndex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 10,
  },
  closeButtonText: {
    fontSize: 18,
    color: 'black',
  },
});

export default GlobalModal;
