import { ThemedText } from '@/components/ThemedText';
import { useState } from 'react';
import { Text, StyleSheet, View, TextInput } from 'react-native';


export default function ConnectScreen() {
	const [url, setUrl] = useState('wss://');
	return (
		<View className='flex justify-center w-full h-full items-center gap-4'>
			<ThemedText className='text-2xl '>Connect</ThemedText>
			<ThemedText className='text-2xl '>url: {url}</ThemedText>
			<TextInput
				className='text-2xl border-white border text-red-500 h-12 '
				placeholder="Enter url"
				value={url}
				onChangeText={setUrl}
			/>
		</View>
	);
}


