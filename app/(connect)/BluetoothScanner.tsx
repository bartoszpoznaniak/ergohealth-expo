import React, { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform, View, Text, Button, FlatList } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { BleManager, Device } from 'react-native-ble-plx'; // Zaimportuj typ Device

interface DeviceItemProps {
	item: Device;
}

export default function BluetoothScanner() {
	const [devices, setDevices] = useState<Device[]>([]);
	const [isScanning, setIsScanning] = useState(false);
	const [scanning, setScanning] = useState(false);
	const bleManager = new BleManager();

	const [status, setStatus] = useState("NONE");

	useEffect(() => {
		const requestPermissions = async () => {
			if (Platform.OS === 'android' && Platform.Version >= 31) {
				const granted = await PermissionsAndroid.requestMultiple([
					PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
					PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
					PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
				]);
				if (
					granted['android.permission.BLUETOOTH_SCAN'] !== 'granted' ||
					granted['android.permission.BLUETOOTH_CONNECT'] !== 'granted' ||
					granted['android.permission.ACCESS_FINE_LOCATION'] !== 'granted'
				) {
					console.log('Brak wymaganych uprawnień Bluetooth');
					return false;
				}
				return true;
			} else if (Platform.OS === 'android') {
				const granted = await PermissionsAndroid.request(
					PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
				);
				if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
					console.log('Brak uprawnień lokalizacji (wymagane dla BLE na Androidzie)');
					return false;
				}
				return true;
			} else if (Platform.OS === 'ios') {
				return true; // iOS nie wymaga specjalnych uprawnień w tym miejscu
			}
			return true;
		};

		const checkBluetoothState = async () => {
			const state = await bleManager.state();
			if (state !== 'PoweredOn') {
				console.log('Bluetooth jest wyłączony. Włącz go, aby skanować urządzenia.');
				// Możesz tutaj dodać logikę informującą użytkownika o włączeniu Bluetooth
			}
		};

		requestPermissions().then((permissionsGranted) => {
			if (permissionsGranted) {
				checkBluetoothState();
			}
		});

		return () => {
			bleManager.stopDeviceScan();
			bleManager.destroy();
		};
	}, []);

	const requestPermissions = async () => {
		if (Platform.OS === 'android') {
			await PermissionsAndroid.requestMultiple([
				PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
				PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
				PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
			]);
		}
	};

	const startScan = () => {
		if (!scanning) {
			setScanning(true);
			setDevices([]); // Wyczyść poprzednie wyniki skanowania

			bleManager.startDeviceScan(
				null, // Możesz podać tablicę UUID serwisów do filtrowania, np. ['0000180D-0000-1000-8000-00805F9B34FB'] dla serwisu HR
				null, // Opcje skanowania (puste dla domyślnych)
				(error, device) => {
					if (error) {
						console.log('Błąd skanowania:', error);
						setScanning(false);
						return;
					}

					if (device && device.name && device.name.startsWith('ErgoHealth-')) {
						// Dodaj urządzenie do stanu tylko jeśli jego nazwa zaczyna się od "Dym-"
						setDevices((prevDevices) => {
							const isDuplicate = prevDevices.some((d) => d.id === device.id);
							if (!isDuplicate) {
								return [...prevDevices, device];
							}
							return prevDevices;
						});
					}
				}
			);

			// Zatrzymaj skanowanie po określonym czasie (np. 5 sekund)
			setTimeout(() => {
				bleManager.stopDeviceScan();
				setScanning(false);
				console.log('Skanowanie zakończone.');
			}, 5000);
		}
	};

	const renderItem = ({ item }: DeviceItemProps) => ( // Dodaj typowanie dla props
		<View className='text-white' style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#ccc' }}>
			<Text className='text-white'>Nazwa: {item.name || 'Nieznana'}</Text>
			<Text className='text-white'>ID: {item.id}</Text>
		</View>
	);

	return (
		<View style={{ flex: 1, padding: 20 }}>
			<Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 15 }}>Skaner Urządzeń Bluetooth BLE</Text>
			<Button title={scanning ? 'Skanowanie...' : 'Rozpocznij Skanowanie'} onPress={startScan} disabled={scanning} />
			<Text className='text-white'>LEN: {devices.length}</Text>
			<FlatList
				data={devices}
				renderItem={renderItem}
				className='text-white'
				keyExtractor={(item) => item.id}
				style={{ marginTop: 20 }}
				ListEmptyComponent={() => (
					<Text className='text-white' style={{ color: 'white', textAlign: 'center', marginTop: 10 }}>
						{scanning ? 'Wyszukiwanie urządzeń...' : 'Nie znaleziono żadnych urządzeń. Spróbuj ponownie skanować.'}
					</Text>
				)}
			/>
		</View>
	);
}
