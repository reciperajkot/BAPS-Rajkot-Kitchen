import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';
import BookingV2 from './BookingV2';
import AdminMasters from './AdminMasters';

type Role = 'admin' | 'counter' | 'production' | 'dispatch';
type BookingStatus = 'new' | 'approved' | 'in_production' | 'ready' | 'dispatched' | 'served' | 'cancelled';
type Profile = { id: string; full_name: string | null; mobile: string | null; role: Role; is_active: boolean };
type Booking = { id: string; service_date: string; customer_name: string; mobile: string | null; people_count: number; location: string; service_time: string; menu_details: string | null; status: BookingStatus; created_at: string };

const roleLabel: Record<Role, string> = { admin: 'Super Admin', counter: 'Cash Counter / Seva', production: 'Production', dispatch: 'Dispatch / Seva Provider' };
const statusLabel: Record<BookingStatus, string> = { new: 'New', approved: 'Approved', in_production: 'In production', ready: 'Ready', dispatched: 'Dispatched', served: 'Served', cancelled: 'Cancelled' };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); if (!nextSession) setProfile(null); });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) return;
    let mounted = true;
    async function loadProfile() {
      setLoading(true);
      const { data, error } = await supabase.from('profiles').select('id, full_name, mobile, role, is_active').eq('id', session.user.id).single();
      if (!mounted) return;
      setLoading(false);
      if (error || !data) { Alert.alert('Account setup problem', 'Your user profile could not be found. Please contact the Super Admin.'); await supabase.auth.signOut(); return; }
      if (!data.is_active) { Alert.alert('Account inactive', 'This account is not active. Please contact the Super Admin.'); await supabase.auth.signOut(); return; }
      setProfile(data as Profile);
    }
    loadProfile();
    return () => { mounted = false; };
  }, [session?.user.id]);

  if (!isSupabaseConfigured) return <SetupScreen />;
  if (loading) return <LoadingScreen />;
  if (!session) return <LoginScreen />;
  if (!profile) return <LoadingScreen />;
  return <Dashboard profile={profile} />;
}

function LoginScreen() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [submitting, setSubmitting] = useState(false);
  async function signIn() {
    if (!email.trim() || !password) return Alert.alert('Details needed', 'Enter your email address and password.');
    if (!supabase) return; setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }); setSubmitting(false);
    if (error) Alert.alert('Login failed', 'Please check your email address and password, then try again.');
  }
  return <SafeAreaView style={s.loginSafe}><StatusBar style="dark" /><View style={s.loginCard}>
    <Text style={s.logo}>🛕</Text><Text style={s.loginTitle}>BAPS Rajkot Rasoi Seva</Text><Text style={s.loginSub}>Seva management system</Text>
    <Text style={s.label}>Email address</Text><TextInput value={email} onChangeText={setEmail} placeholder="your@email.com" style={s.input} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
    <Text style={s.label}>Password</Text><TextInput value={password} onChangeText={setPassword} placeholder="Password" style={s.input} secureTextEntry autoCapitalize="none" />
    <Pressable disabled={submitting} onPress={signIn} style={[s.primary, submitting && s.disabled]}><Text style={s.primaryText}>{submitting ? 'Logging in…' : 'Login'}</Text></Pressable>
    <Text style={s.note}>Your assigned role opens the correct dashboard automatically.</Text>
  </View></SafeAreaView>;
}

function Dashboard({ profile }: { profile: Profile }) {
  const [bookings, setBookings] = useState<Booking[]>([]); const [loadingBookings, setLoadingBookings] = useState(true); const [screen, setScreen] = useState<'home' | 'new' | 'bookings' | 'manage'>('home');
  async function loadBookings() {
    if (!supabase) return; setLoadingBookings(true);
    const { data, error } = await supabase.from('bookings').select('id, service_date, customer_name, mobile, people_count, location, service_time, menu_details, status, created_at').order('service_date', { ascending: true }).order('service_time', { ascending: true });
    setLoadingBookings(false);
    if (error) { Alert.alert('Booking setup needed', 'Please run the Booking Setup SQL file in Supabase before using bookings.'); return; }
    setBookings((data ?? []) as Booking[]);
  }
  useEffect(() => { loadBookings(); }, []);
  async function logout() { if (supabase) await supabase.auth.signOut(); }

  const page = screen === 'new' ? <BookingV2 profileId={profile.id} s={s} onSaved={() => { setScreen('bookings'); loadBookings(); }} /> : screen === 'manage' ? <AdminMasters s={s} /> : screen === 'bookings' ? <BookingList bookings={bookings} loading={loadingBookings} title="Bookings" /> : <Home profile={profile} bookings={bookings} loading={loadingBookings} onNew={() => setScreen('new')} onList={() => setScreen('bookings')} />;
  return <SafeAreaView style={s.safe}><StatusBar style="dark" /><View style={s.header}><View style={s.headerText}><Text style={s.appTitle}>BAPS Rajkot Rasoi Seva</Text><Text style={s.role}>{roleLabel[profile.role]} • {profile.full_name || 'Sevak'}</Text></View><Pressable onPress={logout} style={s.logout}><Text>Logout</Text></Pressable></View><ScrollView contentContainerStyle={s.body}>{page}</ScrollView><BottomBar role={profile.role} screen={screen} setScreen={setScreen} /></SafeAreaView>;
}

function Home({ profile, bookings, loading, onNew, onList }: { profile: Profile; bookings: Booking[]; loading: boolean; onNew: () => void; onList: () => void }) {
  if (profile.role === 'admin') return <View><Text style={s.h1}>Super Admin Dashboard</Text><Text style={s.muted}>All Rasoi Seva bookings are visible here.</Text><View style={s.grid}><Card title="Total bookings" value={loading ? '…' : String(bookings.length)} icon="📋" /><Card title="New" value={loading ? '…' : String(bookings.filter(b => b.status === 'new').length)} icon="🆕" /><Card title="Ready" value={loading ? '…' : String(bookings.filter(b => b.status === 'ready').length)} icon="✅" /><Card title="Served" value={loading ? '…' : String(bookings.filter(b => b.status === 'served').length)} icon="🙏" /></View><Action text="View all bookings" onPress={onList} /></View>;
  if (profile.role === 'counter') return <View><Text style={s.h1}>Cash Counter / Seva</Text><Text style={s.muted}>Create a new Rasoi Seva booking, then view bookings you created.</Text><Action text="＋ New Rasoi Seva Booking" onPress={onNew} /><Action text="View my bookings" onPress={onList} /></View>;
  const relevant = profile.role === 'production' ? bookings.filter(b => ['new', 'approved', 'in_production', 'ready'].includes(b.status)) : bookings.filter(b => ['ready', 'dispatched', 'served'].includes(b.status));
  return <View><Text style={s.h1}>{profile.role === 'production' ? 'Production' : 'Dispatch / Seva'}</Text><Text style={s.muted}>{profile.role === 'production' ? 'Bookings waiting for kitchen preparation.' : 'Bookings ready for dispatch or seva.'}</Text><View style={s.grid}><Card title="Relevant bookings" value={loading ? '…' : String(relevant.length)} icon={profile.role === 'production' ? '🍲' : '🚚'} /><Card title="Ready" value={loading ? '…' : String(bookings.filter(b => b.status === 'ready').length)} icon="✅" /></View><Action text="View bookings" onPress={onList} /></View>;
}

function BookingForm({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [serviceDate, setServiceDate] = useState(''); const [customerName, setCustomerName] = useState(''); const [mobile, setMobile] = useState(''); const [people, setPeople] = useState(''); const [location, setLocation] = useState(''); const [serviceTime, setServiceTime] = useState(''); const [menu, setMenu] = useState(''); const [saving, setSaving] = useState(false);
  async function save() {
    if (!serviceDate || !customerName.trim() || !people || !location.trim() || !serviceTime) return Alert.alert('Details needed', 'Please complete date, name, people, place and time.');
    const peopleCount = Number(people); if (!Number.isInteger(peopleCount) || peopleCount < 1) return Alert.alert('Check people', 'Enter a whole number greater than zero.');
    if (!supabase) return; setSaving(true);
    const { error } = await supabase.from('bookings').insert({ service_date: serviceDate, customer_name: customerName.trim(), mobile: mobile.trim() || null, people_count: peopleCount, location: location.trim(), service_time: serviceTime, menu_details: menu.trim() || null, created_by: profile.id });
    setSaving(false); if (error) return Alert.alert('Could not save booking', error.message);
    Alert.alert('Booking saved', 'The new Rasoi Seva booking has been saved.'); onSaved();
  }
  return <View><Text style={s.h1}>New Rasoi Seva Booking</Text><Text style={s.muted}>Enter the booking details. Fields marked with * are required.</Text>
    <Text style={s.label}>Service date *</Text><TextInput value={serviceDate} onChangeText={setServiceDate} placeholder="YYYY-MM-DD" style={s.input} />
    <Text style={s.label}>Customer / group name *</Text><TextInput value={customerName} onChangeText={setCustomerName} placeholder="Name" style={s.input} />
    <Text style={s.label}>Mobile number</Text><TextInput value={mobile} onChangeText={setMobile} placeholder="Mobile number" style={s.input} keyboardType="phone-pad" />
    <Text style={s.label}>Number of people *</Text><TextInput value={people} onChangeText={setPeople} placeholder="Example: 150" style={s.input} keyboardType="number-pad" />
    <Text style={s.label}>Place *</Text><TextInput value={location} onChangeText={setLocation} placeholder="Location / hall" style={s.input} />
    <Text style={s.label}>Service time *</Text><TextInput value={serviceTime} onChangeText={setServiceTime} placeholder="HH:MM (example: 18:30)" style={s.input} />
    <Text style={s.label}>Menu details</Text><TextInput value={menu} onChangeText={setMenu} placeholder="Example: khichdi, kadhi, puri" style={[s.input, s.multiline]} multiline />
    <Pressable disabled={saving} onPress={save} style={[s.primary, saving && s.disabled]}><Text style={s.primaryText}>{saving ? 'Saving…' : 'Save booking'}</Text></Pressable>
  </View>;
}

function BookingList({ bookings, loading, title }: { bookings: Booking[]; loading: boolean; title: string }) {
  return <View><Text style={s.h1}>{title}</Text>{loading ? <ActivityIndicator size="large" color="#1F6B4F" /> : bookings.length === 0 ? <Text style={s.muted}>No bookings yet.</Text> : bookings.map(b => <View key={b.id} style={s.booking}><View style={s.bookingTop}><Text style={s.userName}>{b.customer_name}</Text><Text style={s.status}>{statusLabel[b.status]}</Text></View><Text style={s.muted}>{b.service_date} • {b.service_time} • {b.people_count} people</Text><Text style={s.muted}>{b.location}{b.menu_details ? ` • ${b.menu_details}` : ''}</Text></View>)}</View>;
}

function BottomBar({ role, screen, setScreen }: { role: Role; screen: string; setScreen: (screen: 'home' | 'new' | 'bookings') => void }) {
  const items: Array<['home' | 'new' | 'bookings', string, string]> = role === 'counter' ? [['home', '⌂', 'Home'], ['new', '＋', 'New Booking'], ['bookings', '📋', 'Bookings']] : [['home', '⌂', 'Home'], ['bookings', '📋', 'Bookings']];
  return <View style={s.nav}>{items.map(([id, icon, label]) => <Pressable key={id} onPress={() => setScreen(id)} style={s.navItem}><Text style={s.navIcon}>{icon}</Text><Text style={screen === id ? s.navOn : s.navText}>{label}</Text></Pressable>)}</View>;
}
function Card({ title, value, icon }: { title: string; value: string; icon: string }) { return <View style={s.card}><Text style={s.icon}>{icon}</Text><Text style={s.muted}>{title}</Text><Text style={s.value}>{value}</Text></View>; }
function Action({ text, onPress }: { text: string; onPress: () => void }) { return <Pressable onPress={onPress} style={s.action}><Text style={s.actionText}>{text}</Text><Text>›</Text></Pressable>; }
function LoadingScreen() { return <SafeAreaView style={s.center}><ActivityIndicator size="large" color="#1F6B4F" /><Text style={s.loadingText}>Opening BAPS Rajkot Rasoi Seva…</Text></SafeAreaView>; }
function SetupScreen() { return <SafeAreaView style={s.loginSafe}><View style={s.loginCard}><Text style={s.loginTitle}>Connect Supabase first</Text><Text style={s.muted}>Run START_APP.bat and enter the Project URL and Publishable key. Never use a secret key.</Text></View></SafeAreaView>; }

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F7F4EE'}, loginSafe:{flex:1,backgroundColor:'#F7F4EE',justifyContent:'center',padding:20}, center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#F7F4EE'}, loadingText:{marginTop:14,color:'#555'}, loginCard:{backgroundColor:'#fff',borderRadius:24,padding:26,elevation:3}, logo:{fontSize:42,textAlign:'center'}, loginTitle:{fontSize:25,fontWeight:'800',textAlign:'center',marginTop:8}, loginSub:{textAlign:'center',color:'#777',marginBottom:24}, header:{paddingHorizontal:18,paddingVertical:14,backgroundColor:'#fff',flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#eee'}, headerText:{flex:1,marginRight:10}, appTitle:{fontSize:18,fontWeight:'800'}, role:{fontSize:12,color:'#777',marginTop:2}, logout:{padding:9,borderRadius:10,backgroundColor:'#eee'}, body:{padding:18,paddingBottom:94}, h1:{fontSize:26,fontWeight:'800',marginBottom:7}, muted:{color:'#777',lineHeight:20}, grid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginVertical:18}, card:{backgroundColor:'#fff',borderRadius:18,padding:16,width:'47%',minHeight:120,elevation:1}, icon:{fontSize:27}, value:{fontSize:30,fontWeight:'800',marginTop:8}, input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#ddd',borderRadius:12,padding:13,marginBottom:12,fontSize:16}, multiline:{minHeight:92,textAlignVertical:'top'}, label:{fontWeight:'700',marginBottom:7}, primary:{backgroundColor:'#1F6B4F',padding:15,borderRadius:13,alignItems:'center',marginVertical:8}, disabled:{opacity:0.65}, primaryText:{color:'#fff',fontSize:16,fontWeight:'800'}, note:{fontSize:12,color:'#777',textAlign:'center',marginTop:12,lineHeight:18}, userName:{fontWeight:'800',fontSize:16}, action:{backgroundColor:'#fff',borderRadius:15,padding:17,marginTop:10,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, actionText:{fontSize:16,fontWeight:'700'}, booking:{backgroundColor:'#fff',padding:15,borderRadius:14,marginTop:10}, bookingTop:{flexDirection:'row',justifyContent:'space-between',gap:8,marginBottom:5}, status:{fontSize:12,fontWeight:'800',color:'#1F6B4F'}, nav:{position:'absolute',left:0,right:0,bottom:0,height:72,backgroundColor:'#fff',borderTopWidth:1,borderTopColor:'#eee',flexDirection:'row',justifyContent:'space-around'}, navItem:{alignItems:'center',justifyContent:'center',minWidth:85}, navIcon:{fontSize:20}, navText:{fontSize:12,color:'#777'}, navOn:{fontSize:12,fontWeight:'800',color:'#1F6B4F'},
});
