// Alerts.js
import { Alert } from 'react-native';

// Function to show a generic error alert
export const showErrorAlert = (title, message) => {
    Alert.alert(
        title,
        message,
        [
            { text: 'OK', style: 'cancel' }
        ],
        { cancelable: false }
    );
};

// Function to show a confirmation alert
export const showConfirmationAlert = (title, message, onConfirm, onCancel) => {
    Alert.alert(
        title,
        message,
        [
            { text: 'Cancel', style: 'cancel', onPress: onCancel },
            { text: 'OK', onPress: onConfirm }
        ],
        { cancelable: false }
    );
};

// Function to show an informational alert
export const showInfoAlert = (title, message) => {
    Alert.alert(
        title,
        message,
        [
            { text: 'OK', style: 'default' }
        ],
        { cancelable: true }
    );
};

// Function to show an alert for unimplemented features
export const showUnimplementedFeatureAlert = () => {
    showInfoAlert('Too early!', 'The feature is yet to be implemented by the developer');
};
