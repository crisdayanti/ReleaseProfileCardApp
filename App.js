// App.js
// =====================================================================
// PROFILECARD — versi pengembangan dari materi praktek
// Semua fungsi Level 1 (kamera, galeri, GPS, permission flow, simpan)
// TIDAK diubah logikanya — hanya dirapikan & ditambah fitur baru.
// Fitur baru ditandai komentar "// 🆕 [NAMA FITUR]" supaya gampang dicari.
// =====================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants'; // 🆕 BONUS A: baca versi app dari app.json
import {
  View, Text, StyleSheet,
  Image, TextInput, TouchableOpacity, Alert,
  Linking, ActivityIndicator, ScrollView, Modal, Platform,
  FlatList,
} from 'react-native';

export default function App() {
  const PROFIL_KEY = '@profilecard_data';

  // 🆕 CHECK-IN (Level 2 "📍 Kamera + Lokasi" + Level 2 "🖼️ Galeri Multi-Foto")
  // Satu record gabungan: selfie + koordinat + cuaca + waktu, disimpan
  // sebagai ARRAY (bukan 1 data seperti foto profil), lalu ditampilkan
  // lewat FlatList — jadi 1 fitur ini memenuhi 2 poin Level 2 sekaligus.
  const CHECKIN_KEY = '@profilecard_checkin';

  // 🆕 Kamus singkat kode cuaca WMO -> label & emoji (dipakai untuk
  // menerjemahkan angka "weathercode" dari Open-Meteo jadi teks yang
  // mudah dibaca). Polanya sama seperti yang dipakai di WeatherFinder.
  const LABEL_CUACA = {
    0: { label: 'Cerah', emoji: '☀️' },
    1: { label: 'Cerah Berawan', emoji: '🌤️' },
    2: { label: 'Berawan Sebagian', emoji: '⛅' },
    3: { label: 'Mendung', emoji: '☁️' },
    45: { label: 'Berkabut', emoji: '🌫️' },
    51: { label: 'Gerimis', emoji: '🌦️' },
    61: { label: 'Hujan Ringan', emoji: '🌧️' },
    63: { label: 'Hujan Sedang', emoji: '🌧️' },
    65: { label: 'Hujan Lebat', emoji: '⛈️' },
    80: { label: 'Hujan Lokal', emoji: '🌦️' },
    95: { label: 'Badai Petir', emoji: '🌩️' },
  };
  const labelCuaca = (kode) => LABEL_CUACA[kode] ?? { label: 'Tidak Menentu', emoji: '🌈' };

  const [foto, setFoto] = useState(null);      // URI foto profil
  const [nama, setNama] = useState('');         // nama user
  const [lokasi, setLokasi] = useState(null);   // {latitude, longitude}

  // 🆕 REVERSE GEOCODING — nama tempat dari koordinat (Level 3)
  const [namaTempat, setNamaTempat] = useState(null);

  // 🆕 LOADING STATE — supaya user tahu app lagi proses (bikin UI kerasa "hidup")
  const [loadingLokasi, setLoadingLokasi] = useState(false);
  const [tersimpan, setTersimpan] = useState(false); // badge status simpan

  // 🆕 State untuk modal custom pilih sumber foto (ganti Alert.alert bawaan
  // OS yang tidak bisa di-styling, jadi modal buatan sendiri yang elegan)
  const [modalFotoVisible, setModalFotoVisible] = useState(false);

  // 🆕 State untuk fitur Check-in (riwayat gabungan foto + lokasi + cuaca)
  const [riwayatCheckin, setRiwayatCheckin] = useState([]);
  const [loadingCheckin, setLoadingCheckin] = useState(false);

  // ---------------------------------------------------------------
  // FITUR LEVEL 1 (ASLI, tidak diubah) — ambil foto dari kamera
  // ---------------------------------------------------------------
  async function ambilFoto() {
    const izin = await ImagePicker.requestCameraPermissionsAsync();

    if (izin.status !== 'granted') {
      // 🆕 TOMBOL SETTINGS — dulu cuma "OK", sekarang ada jalan pintas ke Pengaturan HP
      tampilkanPenolakanIzin('kamera');
      return;
    }

    const hasil = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!hasil.canceled) {
      setFoto(hasil.assets[0].uri);
      setTersimpan(false); // 🆕 badge: ada perubahan yang belum disimpan
    }
  }

  // ---------------------------------------------------------------
  // FITUR LEVEL 1 (ASLI, tidak diubah) — ambil foto dari galeri
  // ---------------------------------------------------------------
  async function pilihDariGaleri() {
    const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (izin.status !== 'granted') {
      tampilkanPenolakanIzin('galeri');
      return;
    }

    const hasil = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!hasil.canceled) {
      setFoto(hasil.assets[0].uri);
      setTersimpan(false);
    }
  }

  // FITUR LEVEL 1 (ASLI, logika tidak diubah) — hanya CARA MENAMPILKANNYA
  // yang berubah: dari Alert.alert() bawaan OS jadi modal custom (lihat
  // <Modal> di bagian JSX) supaya bisa didesain rapi & elegan.
  // Modal berisi penjelasan singkat + pilihan Kamera/Galeri jadi satu
  // tampilan yang mulus (menggantikan priming + Alert terpisah).
  function primingFoto() {
    setModalFotoVisible(true);
  }

  // 🆕 PENTING: modal custom (<Modal>) butuh waktu untuk benar-benar
  // tertutup (animasi) sebelum kamera/galeri sistem dibuka. Kalau
  // langsung dipanggil di saat bersamaan, kamera bisa gagal muncul atau
  // ke-cancel sendiri. Solusinya: tutup modal dulu, kasih jeda sedikit,
  // baru panggil fungsi kamera/galeri aslinya.
  function tutupModalLaluKamera() {
    setModalFotoVisible(false);
    setTimeout(() => {
      ambilFoto();
    }, Platform.OS === 'ios' ? 500 : 300);
  }

  function tutupModalLaluGaleri() {
    setModalFotoVisible(false);
    setTimeout(() => {
      pilihDariGaleri();
    }, Platform.OS === 'ios' ? 500 : 300);
  }

  // 🆕 HAPUS FOTO (Level 3 bonus) — reset foto ke placeholder
  function hapusFoto() {
    Alert.alert(
      'Hapus Foto?',
      'Foto profil akan dikembalikan ke placeholder.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            setFoto(null);
            setTersimpan(false);
          },
        },
      ]
    );
  }

  // 🆕 PRIMING SCREEN (Level 3 bonus) — layar penjelasan SEBELUM dialog
  // izin sistem muncul. Dipisah dari ambilLokasi() asli supaya alur
  // permission Level 1 tetap sama persis, cuma dikasih "pengantar" dulu.
  function primingLokasi() {
    Alert.alert(
      '📍 Kenapa kami butuh lokasi?',
      'Lokasi dipakai untuk menampilkan koordinat & nama tempatmu saat ini di kartu profil. Data ini hanya disimpan di HP-mu sendiri.',
      [
        { text: 'Tidak Sekarang', style: 'cancel' },
        { text: 'Lanjutkan', onPress: tutupAlertLaluLokasi },
      ]
    );
  }

  // 🆕 Sama seperti kamera/galeri: kasih jeda sedikit setelah dialog
  // (Alert) tertutup, baru panggil fungsi GPS asli. Ini mencegah race
  // condition di beberapa HP Android yang bikin getCurrentPositionAsync
  // gagal/hang kalau dipanggil persis di saat Alert masih menutup.
  function tutupAlertLaluLokasi() {
    setTimeout(() => {
      ambilLokasi();
    }, Platform.OS === 'ios' ? 500 : 300);
  }

  // ---------------------------------------------------------------
  // FITUR LEVEL 1 (ASLI) — ambil lokasi GPS
  // 🆕 ditambah: loading indicator + reverse geocoding otomatis
  // ---------------------------------------------------------------
  async function ambilLokasi() {
    const izin = await Location.requestForegroundPermissionsAsync();

    if (izin.status !== 'granted') {
      tampilkanPenolakanIzin('lokasi');
      return;
    }

    setLoadingLokasi(true); // 🆕
    try {
      const posisi = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const koordinatBaru = {
        latitude: posisi.coords.latitude,
        longitude: posisi.coords.longitude,
      };
      setLokasi(koordinatBaru);
      setTersimpan(false);

      // 🆕 REVERSE GEOCODING — ubah koordinat jadi nama tempat (Level 3)
      const geo = await Location.reverseGeocodeAsync(koordinatBaru);
      if (geo && geo.length > 0) {
        const tempat = geo[0];
        const bagian = [tempat.street, tempat.district, tempat.city, tempat.region]
          .filter(Boolean); // buang yang null/undefined
        setNamaTempat(bagian.join(', '));
      } else {
        setNamaTempat(null);
      }
    } catch (e) {
      Alert.alert('Gagal Ambil Lokasi', 'Pastikan GPS HP kamu aktif, lalu coba lagi.');
    } finally {
      setLoadingLokasi(false); // 🆕
    }
  }

  // 🆕 BUKA DI MAPS (Level 2) — buka koordinat via Google Maps
  function bukaDiMaps() {
    if (!lokasi) return;
    const url = `https://www.google.com/maps?q=${lokasi.latitude},${lokasi.longitude}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Gagal Membuka', 'Tidak bisa membuka aplikasi Maps.')
    );
  }

  // 🆕 HAPUS LOKASI (Level 3 bonus, pola sama seperti hapusFoto())
  function hapusLokasi() {
    Alert.alert(
      'Hapus Lokasi?',
      'Koordinat & nama tempat yang tersimpan akan dihapus.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            setLokasi(null);
            setNamaTempat(null);
            setTersimpan(false);
          },
        },
      ]
    );
  }

  // 🆕 GPS + API CUACA (Level 3 bonus) — ambil cuaca langsung pakai lat/lon
  // dari GPS (tidak perlu geocoding kota dulu seperti WeatherFinder, karena
  // koordinatnya sudah ada). Endpoint & pola fetch mengikuti WeatherFinder.
  async function ambilCuacaOpenMeteo(lat, lon) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
      const res = await fetch(url);
      const data = await res.json();
      const cw = data.current_weather;
      if (!cw) return null;
      const info = labelCuaca(cw.weathercode);
      return { suhu: Math.round(cw.temperature), label: info.label, emoji: info.emoji };
    } catch (e) {
      console.log('Gagal ambil cuaca:', e);
      return null; // check-in tetap lanjut walau cuaca gagal diambil
    }
  }

  // 🆕 PRIMING CHECK-IN — jelasin dulu kenapa butuh kamera + lokasi
  // sekaligus, sebelum dua permintaan izin muncul berturut-turut.
  function primingCheckin() {
    Alert.alert(
      '📸📍 Check-in Sekarang?',
      'Aplikasi akan meminta izin kamera untuk selfie, lalu izin lokasi untuk mencatat koordinat & cuaca saat ini. Semua tersimpan sebagai satu riwayat.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Lanjutkan',
          onPress: () => setTimeout(jalankanCheckin, Platform.OS === 'ios' ? 500 : 300),
        },
      ]
    );
  }

  // 🆕 CHECK-IN — gabungkan foto (kamera) DAN koordinat lokasi jadi SATU
  // record (Level 2 "📍 Kamera + Lokasi"), lalu ditambahkan ke array
  // riwayat yang ditampilkan lewat FlatList (Level 2 "🖼️ Galeri Multi-Foto").
  async function jalankanCheckin() {
    // Langkah 1: kamera (selfie)
    const izinKamera = await ImagePicker.requestCameraPermissionsAsync();
    if (izinKamera.status !== 'granted') {
      tampilkanPenolakanIzin('kamera');
      return;
    }
    const hasilFoto = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (hasilFoto.canceled) return; // user batal ambil selfie, check-in dihentikan

    // Langkah 2: lokasi
    const izinLokasi = await Location.requestForegroundPermissionsAsync();
    if (izinLokasi.status !== 'granted') {
      tampilkanPenolakanIzin('lokasi');
      return;
    }

    setLoadingCheckin(true);
    try {
      const posisi = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = posisi.coords.latitude;
      const lon = posisi.coords.longitude;

      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      const tempat = geo && geo.length > 0
        ? [geo[0].street, geo[0].district, geo[0].city].filter(Boolean).join(', ')
        : null;

      const cuaca = await ambilCuacaOpenMeteo(lat, lon); // 🆕 Level 3 bonus

      const recordBaru = {
        id: Date.now().toString(),
        foto: hasilFoto.assets[0].uri,
        latitude: lat,
        longitude: lon,
        namaTempat: tempat,
        cuaca, // {suhu, label, emoji} atau null kalau gagal
        waktu: new Date().toLocaleString('id-ID', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        }),
      };

      const riwayatBaru = [recordBaru, ...riwayatCheckin]; // terbaru di atas
      setRiwayatCheckin(riwayatBaru);
      await AsyncStorage.setItem(CHECKIN_KEY, JSON.stringify(riwayatBaru));
    } catch (e) {
      Alert.alert('Gagal Check-in', 'Pastikan GPS HP kamu aktif, lalu coba lagi.');
    } finally {
      setLoadingCheckin(false);
    }
  }

  // 🆕 Hapus 1 entri riwayat check-in
  function hapusCheckin(id) {
    Alert.alert('Hapus Riwayat Ini?', 'Check-in ini akan dihapus permanen.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          const riwayatBaru = riwayatCheckin.filter((item) => item.id !== id);
          setRiwayatCheckin(riwayatBaru);
          await AsyncStorage.setItem(CHECKIN_KEY, JSON.stringify(riwayatBaru));
        },
      },
    ]);
  }
  function tampilkanPenolakanIzin(jenisFitur) {
    Alert.alert(
      'Izin Ditolak',
      `Aplikasi butuh izin ${jenisFitur} untuk fitur ini. Aktifkan lewat Pengaturan HP.`,
      [
        { text: 'Nanti Saja', style: 'cancel' },
        { text: 'Buka Pengaturan', onPress: () => Linking.openSettings() },
      ]
    );
  }

  // ---------------------------------------------------------------
  // FITUR LEVEL 1 + LEVEL 2 (ASLI) — persistensi ke AsyncStorage
  // 🆕 ditambah field lokasi & namaTempat supaya ikut tersimpan juga
  // ---------------------------------------------------------------
  async function simpanProfil(fotoBaru, namaBaru, lokasiBaru, namaTempatBaru) {
    try {
      const data = JSON.stringify({
        foto: fotoBaru,
        nama: namaBaru,
        lokasi: lokasiBaru,
        namaTempat: namaTempatBaru,
      });
      await AsyncStorage.setItem(PROFIL_KEY, data);
      setTersimpan(true); // 🆕
    } catch (e) {
      console.log('Gagal simpan profil:', e);
      Alert.alert('Gagal Menyimpan', 'Terjadi kesalahan saat menyimpan data.');
    }
  }

  // Muat profil saat app dibuka (ASLI, 🆕 ditambah load lokasi & namaTempat)
  useEffect(() => {
    async function muatProfil() {
      const json = await AsyncStorage.getItem(PROFIL_KEY);
      if (json != null) {
        const data = JSON.parse(json);
        setFoto(data.foto);
        setNama(data.nama);
        if (data.lokasi) setLokasi(data.lokasi);       // 🆕
        if (data.namaTempat) setNamaTempat(data.namaTempat); // 🆕
        setTersimpan(true);
      }
    }
    muatProfil();
  }, []);

  // 🆕 Muat riwayat check-in saat app dibuka (persistensi terpisah dari profil)
  useEffect(() => {
    async function muatCheckin() {
      const json = await AsyncStorage.getItem(CHECKIN_KEY);
      if (json != null) setRiwayatCheckin(JSON.parse(json));
    }
    muatCheckin();
  }, []);

  // 🆕 Komponen kecil internal — satu baris tombol bergaya "list item"
  // (ikon bulat + label + panah), dipakai berulang supaya semua tombol
  // konsisten & tidak keliatan kotak polos yang flat.
  function BarisAksi({ ikon, label, warna, onPress, disabled, loading, destruktif }) {
    return (
      <TouchableOpacity
        style={[styles.barisAksi, destruktif && styles.barisAksiDestruktif]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <View style={[styles.ikonBulat, destruktif ? styles.ikonBulatDestruktif : { backgroundColor: warna }]}>
          {loading ? (
            <ActivityIndicator size="small" color={destruktif ? '#d63031' : '#fff'} />
          ) : (
            <Text style={{ fontSize: 16 }}>{destruktif ? '🗑' : ikon}</Text>
          )}
        </View>
        <Text style={[styles.barisAksiLabel, destruktif && { color: '#d63031' }]}>
          {label}
        </Text>
        {!destruktif && <Text style={styles.chevron}>›</Text>}
      </TouchableOpacity>
    );
  }

  // 🆕 Komponen 1 baris riwayat check-in — dipakai sebagai renderItem FlatList
  function KartuCheckin({ item }) {
    return (
      <View style={styles.checkinItem}>
        <Image source={{ uri: item.foto }} style={styles.checkinThumb} />
        <View style={{ flex: 1 }}>
          <Text style={styles.checkinWaktu}>{item.waktu}</Text>
          <Text style={styles.checkinLokasi} numberOfLines={1}>
            📍 {item.namaTempat || `${item.latitude.toFixed(3)}, ${item.longitude.toFixed(3)}`}
          </Text>
          {item.cuaca && (
            <Text style={styles.checkinCuaca}>
              {item.cuaca.emoji} {item.cuaca.suhu}°C · {item.cuaca.label}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={() => hapusCheckin(item.id)} style={styles.checkinHapusBtn}>
          <Text style={{ fontSize: 16 }}>🗑</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* 🆕 HEADER BANNER — dikasih lingkaran dekoratif transparan biar tidak flat */}
        <View style={styles.headerBanner}>
          <View style={styles.deco1} />
          <View style={styles.deco2} />
          <Text style={styles.title}>ProfileCard</Text>
          <Text style={styles.subtitle}>Kamera • Galeri • GPS • Check-in</Text>
        </View>

        {/* 🆕 AVATAR "MENGAMBANG" — sengaja ditaruh di luar card & ditarik
            naik (marginTop negatif) supaya nempel di garis batas header/card,
            gaya profile-card modern, bukan avatar polos di dalam kotak */}
        <View style={styles.avatarWrapper}>
          {foto ? (
            <Image source={{ uri: foto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarKosong]}>
              <Text style={{ fontSize: 36 }}>📷</Text>
            </View>
          )}
          {/* 🆕 Badge pensil kecil di pojok avatar — shortcut visual ke ubahFoto */}
          <TouchableOpacity style={styles.badgeEdit} onPress={primingFoto} activeOpacity={0.8}>
            <Text style={{ fontSize: 14 }}>✏️</Text>
          </TouchableOpacity>
        </View>

        {/* KARTU PROFIL */}
        <View style={styles.card}>

          {/* Input nama, dikasih ikon di kiri biar tidak polos */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIkon}>👋</Text>
            <TextInput
              style={styles.inputNama}
              placeholder="Masukkan nama..."
              placeholderTextColor="#b2bec3"
              value={nama}
              onChangeText={(t) => { setNama(t); setTersimpan(false); }}
            />
          </View>

          {/* 🆕 Badge status simpan dipindah ke atas, dekat nama, biar langsung kelihatan */}
          <View style={[styles.statusPill, tersimpan ? styles.statusPillOk : styles.statusPillWarn]}>
            <Text style={[styles.statusText, { color: tersimpan ? '#00895c' : '#b06a00' }]}>
              {tersimpan ? '✅  Semua perubahan tersimpan' : '●  Ada perubahan belum disimpan'}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Daftar aksi bergaya list, ganti total dari tombol kotak polos */}
          <BarisAksi ikon="✏️" label="Ubah Foto" warna="#00b894" onPress={primingFoto} />

          {foto && (
            <BarisAksi ikon="🗑️" label="Hapus Foto" onPress={hapusFoto} destruktif />
          )}

          <BarisAksi
            ikon="📍"
            label="Ambil Lokasi Saya"
            warna="#0984e3"
            onPress={primingLokasi}
            disabled={loadingLokasi}
            loading={loadingLokasi}
          />

          {/* Tampilkan koordinat jika sudah ada */}
          {lokasi && (
            <View style={styles.lokasiBox}>
              <Text style={styles.koordinat}>
                📍 {lokasi.latitude.toFixed(5)}, {lokasi.longitude.toFixed(5)}
              </Text>

              {namaTempat && (
                <Text style={styles.namaTempat}>🏙️ {namaTempat}</Text>
              )}

              <View style={styles.lokasiTombolRow}>
                <TouchableOpacity style={styles.btnMaps} onPress={bukaDiMaps} activeOpacity={0.8}>
                  <Text style={styles.btnMapsText}>🗺️ Buka di Maps</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnHapusLokasi} onPress={hapusLokasi} activeOpacity={0.8}>
                  <Text style={styles.btnHapusLokasiText}>🗑️ Hapus</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.divider} />

          {/* Tombol Simpan dibuat menonjol (full width, warna solid) sebagai CTA utama */}
          <TouchableOpacity
            style={styles.btnSimpan}
            activeOpacity={0.85}
            onPress={() => {
              simpanProfil(foto, nama, lokasi, namaTempat);
              Alert.alert('Tersimpan!', 'Profil berhasil disimpan.');
            }}
          >
            <Text style={styles.btnSimpanText}>💾  Simpan Profil</Text>
          </TouchableOpacity>
        </View>

        {/* 🆕 KARTU RIWAYAT CHECK-IN — gabungan foto+lokasi (Level 2) +
            ditampilkan pakai FlatList (Level 2 Galeri Multi-Foto) */}
        <View style={[styles.card, { marginTop: 18, paddingTop: 22 }]}>
          <Text style={styles.checkinHeader}>📸📍 Riwayat Check-in</Text>
          <Text style={styles.checkinSub}>Selfie + lokasi + cuaca dalam satu catatan</Text>

          <TouchableOpacity
            style={styles.btnCheckin}
            activeOpacity={0.85}
            onPress={primingCheckin}
            disabled={loadingCheckin}
          >
            {loadingCheckin ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnCheckinText}>📸📍  Check-in Sekarang</Text>
            )}
          </TouchableOpacity>

          {riwayatCheckin.length === 0 ? (
            <Text style={styles.checkinKosong}>Belum ada riwayat check-in.</Text>
          ) : (
            <FlatList
              data={riwayatCheckin}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <KartuCheckin item={item} />}
              scrollEnabled={false}
              contentContainerStyle={{ marginTop: 14, gap: 10 }}
            />
          )}
        </View>

        {/* 🆕 BONUS A (+5): App Version Display — baca versi dari app.json
            lewat expo-constants, ditampilkan sebagai footer kecil */}
        <Text style={styles.footerVersion}>
          ProfileCard v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>

      {/* 🆕 MODAL CUSTOM — pengganti Alert.alert() bawaan OS supaya bisa
          didesain elegan: rounded card, ikon berwarna, tombol jelas.
          Ini yang muncul saat "Ubah Foto" ditekan.
          🆕 FIX WEB: dibungkus {modalFotoVisible && (...)} bukan cuma
          mengandalkan prop visible={false}, karena di React Native Web
          <Modal> yang "tidak terlihat" kadang tetap menutupi seluruh
          layar secara tak kasat mata dan memblokir semua sentuhan. */}
      {modalFotoVisible && (
      <Modal
        visible={modalFotoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalFotoVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalFotoVisible(false)}
        >
          {/* activeOpacity=1 + TouchableOpacity kosong di dalam supaya klik di
              area card TIDAK menutup modal (cuma klik di luar card yang menutup) */}
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <View style={styles.modalHandle} />

            <View style={styles.modalIconCircle}>
              <Text style={{ fontSize: 28 }}>📷</Text>
            </View>

            <Text style={styles.modalTitle}>Ubah Foto Profil</Text>
            <Text style={styles.modalDesc}>
              Pilih dari mana foto profilmu akan diambil.
            </Text>

            <TouchableOpacity
              style={styles.modalOption}
              activeOpacity={0.7}
              onPress={tutupModalLaluKamera}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: '#00b894' }]}>
                <Text style={{ fontSize: 18 }}>📸</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOptionLabel}>Kamera</Text>
                <Text style={styles.modalOptionSub}>Ambil foto baru langsung</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              activeOpacity={0.7}
              onPress={tutupModalLaluGaleri}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: '#0984e3' }]}>
                <Text style={{ fontSize: 18 }}>🖼️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOptionLabel}>Galeri</Text>
                <Text style={styles.modalOptionSub}>Pilih foto yang sudah ada</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalBatal}
              activeOpacity={0.7}
              onPress={() => setModalFotoVisible(false)}
            >
              <Text style={styles.modalBatalText}>Batal</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },

  // Header dengan lingkaran dekoratif transparan (efek "depth" tanpa perlu gradient library)
  headerBanner: {
    width: '100%',
    backgroundColor: '#00b894',
    paddingTop: 56,
    paddingBottom: 60,
    alignItems: 'center',
    overflow: 'hidden',
  },
  deco1: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.10)', top: -50, right: -40,
  },
  deco2: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.12)', bottom: -30, left: -20,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  subtitle: { fontSize: 12, color: '#eafff5', marginTop: 6, letterSpacing: 0.5 },

  // Avatar sengaja ditarik naik (negative margin) supaya "mengambang" di
  // antara header hijau dan card putih — inilah yang bikin nggak flat
  avatarWrapper: {
    alignSelf: 'center', marginTop: -56, marginBottom: -56, zIndex: 2,
  },
  avatar: {
    width: 112, height: 112, borderRadius: 56,
    borderWidth: 4, borderColor: '#fff',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  avatarKosong: {
    backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center',
  },
  badgeEdit: {
    position: 'absolute', bottom: 2, right: 2,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#00b894',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3,
  },

  card: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingTop: 68, paddingBottom: 24, paddingHorizontal: 22,
    alignItems: 'stretch', width: '88%', alignSelf: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 1.5, borderBottomColor: '#eee', paddingBottom: 10,
  },
  inputIkon: { fontSize: 16, marginRight: 8 },
  inputNama: {
    fontSize: 18, fontWeight: '700', color: '#1e272e',
    textAlign: 'center', flexShrink: 1, minWidth: 120,
  },

  // Pil status simpan — kecil, berwarna sesuai kondisi, terasa "hidup"
  statusPill: {
    alignSelf: 'center', marginTop: 12, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
  },
  statusPillOk: { backgroundColor: '#e3fcef' },
  statusPillWarn: { backgroundColor: '#fff4e0' },
  statusText: { fontSize: 12, fontWeight: '600' },

  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 16 },

  // 🆕 Baris aksi bergaya "list-item" — pengganti tombol kotak polos
  barisAksi: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fafbfc', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10,
  },
  barisAksiDestruktif: { backgroundColor: '#fff' },
  ikonBulat: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  // 🆕 versi destruktif: outline merah di atas putih, senada tapi beda dari circle solid lain
  ikonBulatDestruktif: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#d63031',
  },
  barisAksiLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#2d3436' },
  chevron: { fontSize: 20, color: '#b2bec3', fontWeight: '300' },

  // Kotak info lokasi
  lokasiBox: {
    marginTop: 4, marginBottom: 10, width: '100%',
    backgroundColor: '#f0f9ff', borderRadius: 14, padding: 14, alignItems: 'center',
  },
  koordinat: { fontSize: 13, color: '#0984e3', fontWeight: '700' },
  namaTempat: { fontSize: 13, color: '#2d3436', marginTop: 4, textAlign: 'center' },
  lokasiTombolRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnMaps: {
    backgroundColor: '#0984e3', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  btnMapsText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  btnHapusLokasi: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d63031',
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16,
  },
  btnHapusLokasiText: { color: '#d63031', fontWeight: '600', fontSize: 13 },

  // CTA utama — dibuat paling menonjol di kartu
  btnSimpan: {
    backgroundColor: '#6c5ce7', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
    elevation: 3, shadowColor: '#6c5ce7', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  btnSimpanText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // 🆕 Style modal custom pilih sumber foto
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 34, alignItems: 'center',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#dfe6e9', marginBottom: 16,
  },
  modalIconCircle: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#e8f5e9',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e272e' },
  modalDesc: {
    fontSize: 13, color: '#636e72', marginTop: 4, marginBottom: 18, textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    backgroundColor: '#fafbfc', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10,
  },
  modalOptionIcon: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  modalOptionLabel: { fontSize: 15, fontWeight: '700', color: '#2d3436' },
  modalOptionSub: { fontSize: 12, color: '#636e72', marginTop: 1 },
  modalBatal: { marginTop: 6, paddingVertical: 10 },
  modalBatalText: { fontSize: 15, fontWeight: '600', color: '#b2bec3' },

  // 🆕 Style kartu Riwayat Check-in
  checkinHeader: { fontSize: 17, fontWeight: '700', color: '#1e272e', textAlign: 'center' },
  checkinSub: { fontSize: 12, color: '#636e72', textAlign: 'center', marginTop: 3, marginBottom: 16 },
  btnCheckin: {
    backgroundColor: '#00b894', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  btnCheckinText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  checkinKosong: { textAlign: 'center', color: '#b2bec3', fontSize: 13, marginTop: 18 },
  checkinItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fafbfc', borderRadius: 14, padding: 10,
  },
  checkinThumb: { width: 50, height: 50, borderRadius: 12, marginRight: 12 },
  checkinWaktu: { fontSize: 11, color: '#b2bec3', fontWeight: '600' },
  checkinLokasi: { fontSize: 13, color: '#2d3436', fontWeight: '600', marginTop: 2 },
  checkinCuaca: { fontSize: 12, color: '#0984e3', marginTop: 2 },
  checkinHapusBtn: { padding: 8 },

  // 🆕 BONUS A: style footer versi app
  footerVersion: {
    textAlign: 'center', fontSize: 11, color: '#b2bec3',
    marginTop: 20, marginBottom: 10,
  },
});