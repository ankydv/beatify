import { createSlice } from '@reduxjs/toolkit';

const modalSlice = createSlice({
  name: 'modal',
  initialState: {
    isVisible: false,
    content: null, // Holds the React component to display
  },
  reducers: {
    openModal: (state, action) => {
      state.isVisible = true;
      state.content = action.payload; // Set the modal content
    },
    closeModal: (state) => {
      state.isVisible = false;
      state.content = null; // Clear the modal content
    },
  },
});

export const { openModal, closeModal } = modalSlice.actions;
export default modalSlice.reducer;
