import React, { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform, View, Text, Button, FlatList, TouchableOpacity, Alert } from 'react-native';
import { BleManager, Device, Service } from 'react-native-ble-plx'; // Zaimportuj typ Device

interface DeviceItemProps {
	item: Device;
}

// Heart Rate
// 0x180D
const DEVICE_SERVICE_UUID = '0000180D-0000-1000-8000-00805F9B34FB';
const SVC_UUID = '0x180D'
const CHAR_UUID = '0x2A37'

function getShortUUID(fullUUID: string): string | null {
	// Konwertujemy na lowercase, usuwamy myślniki
	const normalized = fullUUID.toLowerCase().replace(/-/g, '');

	// Standardowe UUID SIG mają ten konkretny szablon
	if (normalized.endsWith('00001000800000805f9b34fb')) {
		// Wyciągnij pierwsze 4 bajty = short UUID
		const shortPart = normalized.substring(0, 8);
		const shortUUID = `0x${shortPart.substring(4)}`;
		return shortUUID;
	}

	return null; // Niestandardowy UUID (pełny własny)
}

function isShortUUIDEqual(longUUID1: string, uuid2: string): boolean {
	const uuid1 = getShortUUID(longUUID1);
	return uuid1?.toLowerCase() === uuid2.toLowerCase();
}

export default function BluetoothScanner() {
	const [devices, setDevices] = useState<Device[]>([]);
	const [scanning, setScanning] = useState(false);
	const bleManager = new BleManager();
	const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);

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
			if (connectedDevice) {
				connectedDevice.cancelConnection();
				setConnectedDevice(null);
			}

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

					if (device && device.name &&
						(device.name.startsWith('ErgoHealth-') || device.name.startsWith('Nim'))) {
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
	const inspectDevice = async (device: Device) => {
		try {
			const connectedDevice = await device.connect();
			await connectedDevice.discoverAllServicesAndCharacteristics();

			const services = await connectedDevice.services();

			for (const service of services) {
				if (!isShortUUIDEqual(service.uuid, SVC_UUID)) continue;

				console.log(`🔧 Service UUID: ${getShortUUID(service.uuid)}`);

				const characteristics = await service.characteristics();

				for (const char of characteristics) {
					if (!isShortUUIDEqual(char.uuid, CHAR_UUID)) continue;

					console.log(`  ↪️ Characteristic UUID: ${char.uuid}`);
					console.log(`     DevID: ${getShortUUID(char.uuid)}`);
					console.log(`     Properties:`);
					console.log(`       - Readable: ${char.isReadable}`);
					console.log(`       - Writable With Response: ${char.isWritableWithResponse}`);
					console.log(`       - Writable Without Response: ${char.isWritableWithoutResponse}`);
					console.log(`       - Notifiable: ${char.isNotifiable}`);
					console.log(`       - Indicatable: ${char.isIndicatable}`);
				}
			}
		} catch (error) {
			console.log('❌ Błąd podczas sprawdzania usług i charakterystyk:', error);
		}
	};

	const handleDevicePress = async (device: Device) => {
		try {
			console.log(`Łączenie z urządzeniem ${device.name} (${device.id})`);
			const connectedDevice = await device.connect();
			await connectedDevice.discoverAllServicesAndCharacteristics();

			{/* // Wyślij hasło (przy założeniu, że hasło to string – może trzeba je przekonwertować np. na base64 lub UTF-8) */ }
			{/* await connectedDevice.writeCharacteristicWithResponseForService( */ }
			{/* 	DEVICE_SERVICE_UUID, */ }
			{/* 	PASSWORD_CHARACTERISTIC_UUID, */ }
			{/* 	Buffer.from(DEVICE_PASSWORD, 'utf-8').toString('base64') // zakoduj string do base64 */ }
			{/* ); */ }

			setConnectedDevice(connectedDevice);
			Alert.alert('Połączono!', `Połączono z urządzeniem ${device.name}`);
			await inspectDevice(device);
		} catch (error) {
			console.log('Błąd połączenia:', error);
			Alert.alert('Błąd', 'Nie udało się połączyć z urządzeniem.');
		}
	};

	const renderItem = ({ item }: DeviceItemProps) => (
		<TouchableOpacity
			onPress={() => handleDevicePress(item)}
			style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#ccc' }}
		>
			<Text style={{ color: 'white' }}># Nazwa: {item.name || 'Nieznana'}</Text>
			<Text style={{ color: 'white' }}>ID: {item.id}</Text>
		</TouchableOpacity>
	);

	return (
		<View style={{ flex: 1, padding: 20 }}>
			<Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 15 }}>Skaner Urządzeń Bluetooth BLE</Text>
			<Button title={scanning ? 'Skanowanie...' : 'Rozpocznij Skanowanie'} onPress={startScan} disabled={scanning} />
			<Text className='text-white'>LEN: {devices.length}</Text>
			{connectedDevice && (
				<Button title='Info' onPress={() => inspectDevice(connectedDevice)} />
			)}
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
