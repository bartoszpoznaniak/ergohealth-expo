import { ThemedText } from '@/components/ThemedText';
import { useState } from 'react';
import { Text, StyleSheet, View, TextInput } from 'react-native';
import BluetoothScanner from './BluetoothScanner';


export default function ConnectScreen() {
	const [url, setUrl] = useState('wss://');


	return (
		<BluetoothScanner />
	);
}


