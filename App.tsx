import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, Platform, Linking, Image, useWindowDimensions, LayoutAnimation, UIManager } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Role = 'admin' | 'counter' | 'production' | 'dispatch' | 'super_admin';
type Profile = { id: string; full_name: string | null; mobile: string | null; role: Role; is_active: boolean; duty_places?: string[]; photo_url?: string; login_email?: string; login_pass?: string };

const roleLabel: Record<Role, string> = { admin: 'Admin', super_admin: 'Super Admin', counter: 'Cash Counter', production: 'Production (રસોડું)', dispatch: 'Dispatch' };

const BASE_MAIN_TYPES = ['નાસ્તો', 'મોર્નિંગ સ્નેક', 'લંચ', 'હાઈ ટી', 'ડિનર', 'નાઈટ સ્નેક'];
const BASE_SUB_TYPES = ['મિષ્ટાન્ન', 'ફરસાણ', 'રોટલી', 'શાક', 'પનીર પંજાબી', 'વેજ. પંજાબી', 'કઠોળ', 'ભાત', 'દાળ', 'સલાડ', 'છાશ', 'મુખવાસ', 'લિક્વિડ', 'વિશેષ'];

function getTodayStr() { const d = new Date(); return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`; }
function getTomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`; }
function parseTimeForSort(timeStr: string) { if (!timeStr) return 0; const [time, modifier] = timeStr.split(' '); if (!time || !modifier) return 0; let [h, m] = time.split(':'); let hr = parseInt(h, 10); if (hr === 12) hr = 0; if (modifier === 'PM') hr += 12; return (hr * 60) + parseInt(m, 10); }

const showMsg = (title: string, msg: string) => { if (Platform.OS === 'web') window.alert(title + " \n\n" + msg); else Alert.alert(title, msg); };

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
      const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (!mounted) return;
      setLoading(false);
      if (error || !data || !data.is_active) { showMsg('ભૂલ', 'તમારું એકાઉન્ટ બંધ છે.'); await supabase.auth.signOut(); return; }
      let pList: string[] = [];
      if (data.duty_places) {
          if (Array.isArray(data.duty_places)) pList = data.duty_places;
          else if (typeof data.duty_places === 'string') { try { pList = JSON.parse(data.duty_places); } catch(e) { pList = [data.duty_places]; } }
      }
      setProfile({...data, duty_places: pList} as Profile);
    }
    loadProfile();
    return () => { mounted = false; };
  }, [session?.user.id]);

  if (!isSupabaseConfigured) return <SetupScreen />;
  if (loading) return <LoadingScreen />;
  if (!session) return <LoginScreen />;
  if (!profile) return <LoadingScreen />;
  return <Dashboard profile={profile} session={session} />;
}

// ================= LOGIN SCREEN =================
function LoginScreen() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [submitting, setSubmitting] = useState(false);
  async function signIn() {
    if (!email.trim() || !password) return showMsg('ભૂલ', 'યુઝર ID અને પાસવર્ડ નાખો');
    if (!supabase) return; setSubmitting(true);
    const rawInput = email.trim().toLowerCase(); const loginEmail = rawInput.includes('@') ? rawInput : `${rawInput}@baps.local`;
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setSubmitting(false); if (error) showMsg('લૉગિન નિષ્ફળ', 'યુઝર ID અથવા પાસવર્ડ ખોટો છે.');
  }
  return (
    <SafeAreaView style={s.loginSafe}>
      <View style={s.webContainer}>
        <View style={s.loginCard}>
          <Image source={require('./assets/icon.png')} style={{ width: 130, height: 130, alignSelf: 'center', marginBottom: 15, resizeMode: 'contain' }} />
          <Text style={s.loginTitle}>BAPS RAJKOT KITCHEN</Text>
          <Text style={s.loginSub}>Rasoi Seva Management System</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="યુઝર ID (દા.ત. Rasodu1)" style={s.input} autoCapitalize="none" />
          <TextInput value={password} onChangeText={setPassword} placeholder="પાસવર્ડ" style={s.input} secureTextEntry onSubmitEditing={signIn} />
          <Pressable disabled={submitting} onPress={signIn} style={({pressed}) => [s.primary, pressed && {opacity:0.8}]}><Text style={s.primaryText}>{submitting ? 'લૉગ ઇન થઈ રહ્યું છે…' : 'Login'}</Text></Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Dashboard({ profile, session }: { profile: Profile, session: Session }) {
  async function logout() { if (supabase) await supabase.auth.signOut(); }
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <View style={s.headerText}><Text style={s.appTitle}>BAPS Rajkot Kitchen</Text><Text style={s.role}>{roleLabel[profile.role]} • {profile.full_name}</Text></View>
        <Pressable onPress={logout} style={s.logout}><Text style={{fontWeight:'bold', color:'#dc2626'}}>લોગઆઉટ</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={s.webContainer}>
        {(profile.role === 'admin' || profile.role === 'super_admin') ? <AdminHome session={session} profile={profile} /> : null}
        {profile.role === 'counter' ? <CounterHome session={session} profile={profile} /> : null}
        {profile.role === 'production' ? <ProductionHome /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ================= GLOBALLY SORTED ARRAYS HOOK =================
function useSortedCategories() {
  const [sortedMains, setSortedMains] = useState<string[]>([]);
  const [sortedSubs, setSortedSubs] = useState<string[]>([]);
  useEffect(() => {
    async function load() {
      if(!supabase) return;
      const { data } = await supabase.from('menu_items').select('*');
      if (data) {
        const ms = [...data].sort((a,b)=> (a.main_sort||99)-(b.main_sort||99));
        const ss = [...data].sort((a,b)=> (a.sub_sort||99)-(b.sub_sort||99));
        const finalMains = Array.from(new Set(ms.map(d=>d.main_type).filter(Boolean)));
        const finalSubs = Array.from(new Set(ss.map(d=>d.sub_category).filter(Boolean)));
        setSortedMains(finalMains.length > 0 ? finalMains : BASE_MAIN_TYPES);
        setSortedSubs(finalSubs.length > 0 ? finalSubs : BASE_SUB_TYPES);
      }
    }
    load();
  }, []);
  return { sortedMains, sortedSubs };
}

// ================= ADMIN MODULE =================
function AdminHome({ session, profile }: { session: Session, profile: Profile }) { 
  const [activeTab, setActiveTab] = useState<'home'|'menu'|'places'|'users'|'bookings'|'today'|'settings'|'new_booking'>('home');
  const [stats, setStats] = useState({ count: 0, revenue: 0 });
  const [todayData, setTodayData] = useState({ total: 0, mealMap: {} as any });
  const [tomorrowData, setTomorrowData] = useState({ total: 0, mealMap: {} as any });
  const [refreshing, setRefreshing] = useState(false); const [showRevenue, setShowRevenue] = useState(false);
  const { sortedMains } = useSortedCategories();
  const [places, setPlaces] = useState<any[]>([]);

  useEffect(() => { if(activeTab === 'home') fetchDashboard(); }, [activeTab]);

  async function fetchDashboard() {
    if (!supabase) return; setRefreshing(true);
    try {
      const { data, error } = await supabase.from('bookings').select('*');
      const { data: pData } = await supabase.from('places').select('*').eq('is_active', true);
      if (error) throw error;
      if (data) {
        let tRev = 0; const tStr = getTodayStr(); const tomStr = getTomorrowStr();
        let tData = { total: 0, mealMap: {} as any }; let tomData = { total: 0, mealMap: {} as any };

        data.forEach(b => {
          tRev += (b.grand_total || 0);
          if (b.meals) {
            b.meals.forEach((m: any) => {
              const g = m.guestsCount || 0; const hostName = `${b.name || ''} ${b.surname || ''}`.trim() || 'અજ્ઞાત યજમાન';
              if (m.date === tStr) {
                tData.total += g; if(!tData.mealMap[m.mainType]) tData.mealMap[m.mainType] = { count: 0, hosts: [] };
                tData.mealMap[m.mainType].count += g; tData.mealMap[m.mainType].hosts.push(`${hostName} (${g} લોકો)`);
              }
              if (m.date === tomStr) {
                tomData.total += g; if(!tomData.mealMap[m.mainType]) tomData.mealMap[m.mainType] = { count: 0, hosts: [] };
                tomData.mealMap[m.mainType].count += g; tomData.mealMap[m.mainType].hosts.push(`${hostName} (${g} લોકો)`);
              }
            });
          }
        });
        setStats({ count: data.length, revenue: tRev }); setTodayData(tData); setTomorrowData(tomData);
      }
      if (pData) setPlaces(pData);
    } catch (err: any) { showMsg('Error', err.message); } finally { setRefreshing(false); }
  }

  if (activeTab === 'new_booking') return <BookingScreen onBack={() => {setActiveTab('home'); fetchDashboard();}} session={session} profile={profile} allowedPlaces={places} />;
  if (activeTab === 'today') return <TodayReportScreen onBack={() => setActiveTab('home')} />;
  if (activeTab === 'menu') return <AdminMenuScreen onBack={() => setActiveTab('settings')} />;
  if (activeTab === 'places') return <AdminPlacesScreen onBack={() => setActiveTab('settings')} />;
  if (activeTab === 'users') return <AdminUsersScreen onBack={() => setActiveTab('settings')} />;
  if (activeTab === 'bookings') return <AllBookingsScreen onBack={() => setActiveTab('home')} session={session} profile={profile} isAdmin={true} />;

  if (activeTab === 'settings') {
    return (
      <View style={s.p18}>
        <Pressable onPress={()=>setActiveTab('home')} style={s.backButton}><Text style={s.backText}>‹ પાછા ડેશબોર્ડ પર</Text></Pressable>
        <Text style={s.h1}>⚙️ સિસ્ટમ સેટિંગ્સ</Text>
        <View style={{gap: 12, marginTop: 10}}>
          <Pressable onPress={() => setActiveTab('menu')} style={s.menuBtn}><Text style={s.menuBtnText}>🍽️ મેનૂ અને ક્રમ સેટિંગ્સ</Text></Pressable>
          <Pressable onPress={() => setActiveTab('places')} style={s.menuBtn}><Text style={s.menuBtnText}>📍 સ્થળ સેટિંગ્સ</Text></Pressable>
          <Pressable onPress={() => setActiveTab('users')} style={[s.menuBtn, {backgroundColor: '#4f46e5'}]}><Text style={[s.menuBtnText, {color: '#fff'}]}>👤 યુઝર મેનેજમેન્ટ</Text></Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.p18}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, flexWrap: 'wrap', gap: 10}}>
        <Text style={s.h1}>એડમિન ડેશબોર્ડ</Text>
        <View style={{flexDirection: 'row', gap: 10}}>
          <Pressable onPress={()=>setActiveTab('settings')} style={[s.refreshBtn, {backgroundColor: '#1e293b'}]}><Text style={[s.refreshBtnText, {color: '#fff'}]}>⚙️ સેટિંગ્સ</Text></Pressable>
          <Pressable onPress={fetchDashboard} style={s.refreshBtn}><Text style={s.refreshBtnText}>{refreshing ? 'Loading...' : '🔄 રિફ્રેશ'}</Text></Pressable>
        </View>
      </View>
      
      <View style={s.grid}>
        <Card title="કુલ બુકિંગ્સ (Lifetime)" icon="📋" value={stats.count.toString()} />
        <View style={s.card}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
             <Text style={s.icon}>💰</Text>
             <Pressable onPress={() => setShowRevenue(!showRevenue)} style={{padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20}}><Text style={{fontSize: 16}}>{showRevenue ? '🙈' : '👁️'}</Text></Pressable>
          </View>
          <Text style={s.muted}>કુલ સેવા (₹)</Text>
          <Text style={s.value}>{showRevenue ? `₹ ${stats.revenue.toLocaleString()}` : '₹ *******'}</Text>
        </View>
      </View>

      <PreviewWidget title="👥 આજના યજમાનો" dateStr={getTodayStr()} data={todayData} bgColor="#f0fdf4" borderColor="#6ee7b7" sortOrder={sortedMains} />
      <PreviewWidget title="👥 આવતીકાલના યજમાનો" dateStr={getTomorrowStr()} data={tomorrowData} bgColor="#fffbeb" borderColor="#fde047" sortOrder={sortedMains} />

      <Pressable onPress={() => setActiveTab('today')} style={[s.primary, {backgroundColor: '#047857', paddingVertical: 18, marginBottom: 12, marginTop: 10}]}><Text style={{color:'#fff', fontWeight:'900', textAlign: 'center', fontSize: 17}}>📅 આજનો સંપૂર્ણ રિપોર્ટ (Today's Report)</Text></Pressable>
      
      {/* 1. Super Admin Booking Button */}
      {profile.role === 'super_admin' && (
         <Pressable onPress={() => setActiveTab('new_booking')} style={[s.primary, {marginBottom: 12, paddingVertical: 18}]}><Text style={{color:'#fff', fontWeight:'900', textAlign: 'center', fontSize: 17}}>＋ નવી બુકિંગ બનાવો</Text></Pressable>
      )}

      <Pressable onPress={() => setActiveTab('bookings')} style={[s.primary, {backgroundColor: '#ffffff', borderWidth: 2, borderColor:'#047857', marginBottom: 20, paddingVertical: 18}]}><Text style={{color:'#047857', fontWeight:'900', textAlign: 'center', fontSize: 17}}>📋 બધા બુકિંગ્સ (All Bookings)</Text></Pressable>
    </View>
  ); 
}

// Reusable Preview Widget
function PreviewWidget({ title, dateStr, data, bgColor, borderColor, sortOrder }: any) {
  const sortedKeys = Object.keys(data.mealMap).sort((a,b) => {
     let idxA = sortOrder.indexOf(a); let idxB = sortOrder.indexOf(b);
     if(idxA === -1) idxA = 999; if(idxB === -1) idxB = 999;
     return idxA - idxB;
  });
  return (
    <View style={[s.todayGuestsCard, { backgroundColor: bgColor, borderColor: borderColor }]}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: borderColor, paddingBottom: 8, marginBottom: 8}}>
          <Text style={{fontSize: 18, fontWeight: '900', color: '#065f46'}}>{title}</Text>
          <Text style={{color: '#047857', fontWeight: 'bold', fontSize: 13}}>🗓️ {dateStr}</Text>
        </View>
        {sortedKeys.length === 0 ? ( <Text style={{color: '#64748b', fontSize: 14, paddingBottom: 10}}>કોઈ જમણવાર નોંધાયેલ નથી.</Text> ) : (
          <View style={{marginTop: 6}}>
            {sortedKeys.map(mType => (
              <View key={mType} style={{marginBottom: 12}}>
                <View style={s.mealPill}><Text style={{fontSize: 15, color: '#1e293b'}}><Text style={{fontWeight: '900', color: '#047857'}}>{mType}:</Text> {data.mealMap[mType].count} લોકો</Text></View>
                <View style={{paddingLeft: 10, marginTop: 6}}>
                   {data.mealMap[mType].hosts.map((h:string, idx:number) => <Text key={idx} style={{color: '#334155', fontSize: 13, marginBottom: 3}}>• {h}</Text> )}
                </View>
              </View>
            ))}
            <View style={{borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between'}}>
              <Text style={{fontSize: 15, fontWeight: '800', color: '#065f46'}}>કુલ યજમાનોની સંખ્યા:</Text>
              <Text style={{fontSize: 22, fontWeight: '900', color: '#047857'}}>{data.total.toLocaleString()} લોકો</Text>
            </View>
          </View>
        )}
      </View>
  )
}

// ================= TODAY'S REPORT (ADMIN) =================
function TodayReportScreen({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [loading, setLoading] = useState(true);
  const [totalGuests, setTotalGuests] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [mealBreakdown, setMealBreakdown] = useState<Record<string, number>>({});
  const [menuAggregates, setMenuAggregates] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const [dynamicSubs, setDynamicSubs] = useState<string[]>(BASE_SUB_TYPES);
  const todayStr = getTodayStr();

  useEffect(() => { fetchTodayData(); }, []);

  async function fetchTodayData() {
    setLoading(true);
    if (!supabase) return;
    try {
      const { data: menuData } = await supabase.from('menu_items').select('*');
      if (menuData) {
        const sortedMenu = menuData.sort((a,b)=> (a.sub_sort || 99) - (b.sub_sort || 99));
        setDynamicSubs(Array.from(new Set(sortedMenu.map(m=>m.sub_category).filter(Boolean))));
      }

      const { data, error } = await supabase.from('bookings').select('*');
      const { data: pData } = await supabase.from('places').select('*');
      if (error) throw error;

      if (data) {
        let tGuests = 0, tRevenue = 0; let agg: any = {}; let mBreakdown: any = {};
        data.forEach(b => {
          if (b.meals) {
            b.meals.forEach((m: any) => {
              if (m.date === todayStr) {
                const gCount = m.guestsCount || 0;
                tGuests += gCount; tRevenue += (m.ratePerPlate * gCount);
                if (!mBreakdown[m.mainType]) mBreakdown[m.mainType] = 0;
                mBreakdown[m.mainType] += gCount;
                if (!agg[m.mainType]) agg[m.mainType] = {};
                m.items?.forEach((i: any) => {
                  const sub = i.sub_category || 'અન્ય';
                  if (!agg[m.mainType][sub]) agg[m.mainType][sub] = {};
                  if (!agg[m.mainType][sub][i.name]) agg[m.mainType][sub][i.name] = 0;
                  agg[m.mainType][sub][i.name] += gCount; 
                });
              }
            });
          }
        });
        setTotalGuests(tGuests); setTotalRevenue(tRevenue);
        setMenuAggregates(agg); setMealBreakdown(mBreakdown);
      }
    } catch (err: any) { showMsg('Error', err.message); } finally { setLoading(false); }
  }

  function handlePrint() {
    if (Platform.OS === 'web') window.print();
    else showMsg('પ્રિન્ટ', 'પ્રિન્ટ કરવા માટે કૃપા કરીને વેબ બ્રાઉઝરનો ઉપયોગ કરો.');
  }
  if (loading) return <LoadingScreen />;

  return (
    <View style={s.p18}>
      {Platform.OS === 'web' && ( <style>{`@media print { .no-print { display: none !important; } }`}</style> )}
      <Pressable onPress={onBack} style={[s.backButton, Platform.OS === 'web' ? {className: 'no-print'} as any : {}]}><Text style={s.backText}>‹ પાછા ડેશબોર્ડ પર</Text></Pressable>
      <View style={{flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: 15, gap: isMobile ? 12 : 0}}>
        <View><Text style={{fontSize: 26, fontWeight: '900', color: '#047857'}}>આજનો સંપૂર્ણ રિપોર્ટ</Text><Text style={{color: '#64748b', fontSize: 13, fontWeight: 'bold', marginTop: 2}}>{todayStr}</Text></View>
        <View style={{flexDirection: 'row', gap: 8, width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end'}}>
          <Pressable onPress={handlePrint} style={[s.refreshBtn, {backgroundColor: '#d97706', paddingHorizontal: 15, flex: isMobile ? 1 : undefined, alignItems: 'center'}, Platform.OS === 'web' ? {className: 'no-print'} as any : {}]}><Text style={{fontSize: 14, color: '#fff', fontWeight: 'bold'}}>🖨️ પ્રિન્ટ</Text></Pressable>
        </View>
      </View>
      <View style={{flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 15}}>
        <View style={{flex: Platform.OS === 'web' ? 1 : undefined}}>
          <View {...(Platform.OS === 'web' ? { className: 'no-print' } : {})} style={{backgroundColor: '#f0fdf4', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 12}}>
             <Text style={{color: '#166534', fontWeight: 'bold', fontSize: 13}}>આજની કુલ સેવા રકમ</Text>
             <Text style={{fontSize: 30, fontWeight: '900', color: '#047857', marginVertical: 4}}>₹ {totalRevenue.toLocaleString()}</Text>
             <Text style={{color: '#374151', fontWeight: '600'}}>કુલ મહેમાનો: {totalGuests} લોકો</Text>
          </View>
          <View style={{backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0'}}>
            <Text style={{fontSize: 18, fontWeight: '900', color: '#d97706', marginBottom: 12}}>👨‍🍳 રસોડા માટેનું લિસ્ટ</Text>
            {Object.keys(menuAggregates).length === 0 ? ( <Text style={s.muted}>આજે કોઈ જમણવાર નથી.</Text> ) : (
              <ScrollView style={{maxHeight: Platform.OS === 'web' ? 500 : undefined}}>
                {Object.keys(menuAggregates).map(type => (
                  <View key={type} style={{marginBottom: 15, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0'}}>
                    <Text style={{fontSize: 16, fontWeight: 'bold', color: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 6, marginBottom: 8}}>{type} ({mealBreakdown[type] || 0} લોકો)</Text>
                    {Object.keys(menuAggregates[type]).sort((a,b)=> dynamicSubs.indexOf(a) - dynamicSubs.indexOf(b)).map(sub => (
                      <View key={sub} style={{marginBottom: 10}}><Text style={{fontSize: 14, fontWeight: 'bold', color: '#b91c1c', marginBottom: 6}}>{sub}</Text>
                        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
                          {Object.keys(menuAggregates[type][sub]).map(itemName => (
                            <View key={itemName} style={{backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0'}}><Text style={{fontSize: 13, color: '#334155'}}><Text style={{fontWeight: 'bold', color: '#047857'}}>{itemName}</Text> ({menuAggregates[type][sub][itemName]} લોકો)</Text></View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// ================= ADMIN MENU SCREEN (SMART TAP & SWAP ANIMATED) =================
function AdminMenuScreen({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState(''); const [mainType, setMainType] = useState(''); const [subCategory, setSubCategory] = useState(''); const [price, setPrice] = useState(''); 
  const [menuItems, setMenuItems] = useState<any[]>([]); const [editingId, setEditingId] = useState<string | null>(null);
  
  const [dynamicMainTypes, setDynamicMainTypes] = useState<string[]>([]); 
  const [dynamicSubTypes, setDynamicSubTypes] = useState<string[]>([]);
  
  const [searchQuery, setSearchQuery] = useState(''); const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});
  const [showCatManager, setShowCatManager] = useState(false); const [savingSort, setSavingSort] = useState(false);

  // Smart Select States
  const [selectedMainIdx, setSelectedMainIdx] = useState<number | null>(null);
  const [selectedSubIdx, setSelectedSubIdx] = useState<number | null>(null);

  useEffect(() => { fetchMenu(); }, []);

  async function fetchMenu() {
    if (!supabase) return;
    const { data } = await supabase.from('menu_items').select('*').order('created_at', { ascending: false });
    if (data) {
      setMenuItems(data);
      const mSorted = [...data].sort((a,b)=> (a.main_sort ?? 99) - (b.main_sort ?? 99));
      const sSorted = [...data].sort((a,b)=> (a.sub_sort ?? 99) - (b.sub_sort ?? 99));
      
      const mains = Array.from(new Set(mSorted.map(d=>d.main_type).filter(Boolean)));
      const subs = Array.from(new Set(sSorted.map(d=>d.sub_category).filter(Boolean)));
      
      const finalMains = mains.length > 0 ? mains : BASE_MAIN_TYPES;
      const finalSubs = subs.length > 0 ? subs : BASE_SUB_TYPES;
      
      setDynamicMainTypes(finalMains); setDynamicSubTypes(finalSubs);
      if (!name && !editingId) { setMainType(finalMains[0] || 'લંચ'); setSubCategory(finalSubs[0] || 'રોટલી'); }
    }
  }

  async function saveMenu() {
    if (!name.trim() || !price || !supabase) return showMsg('Error', 'વાનગીનું નામ અને સેવા રાશી લખો.');
    const mainSortVal = dynamicMainTypes.indexOf(mainType); const subSortVal = dynamicSubTypes.indexOf(subCategory);
    const finalMSort = mainSortVal > -1 ? mainSortVal : dynamicMainTypes.length;
    const finalSSort = subSortVal > -1 ? subSortVal : dynamicSubTypes.length;
    const payload = { name: name.trim(), main_type: mainType, sub_category: subCategory, price: parseFloat(price) || 0, is_active: true, main_sort: finalMSort, sub_sort: finalSSort };
    try {
      if (editingId) await supabase.from('menu_items').update(payload).eq('id', editingId);
      else await supabase.from('menu_items').insert([payload]);
      setName(''); setPrice(''); setEditingId(null); fetchMenu(); showMsg('Success', 'વાનગી સફળતાપૂર્વક સેવ થઈ ગઈ!');
    } catch (err: any) { showMsg('Error', err.message); }
  }

  const handleMainTap = (idx: number) => {
    if (selectedMainIdx === null) {
      setSelectedMainIdx(idx); 
    } else if (selectedMainIdx === idx) {
      setSelectedMainIdx(null); 
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const newList = [...dynamicMainTypes];
      const temp = newList[selectedMainIdx];
      newList[selectedMainIdx] = newList[idx];
      newList[idx] = temp;
      setDynamicMainTypes(newList);
      setSelectedMainIdx(null); 
    }
  };

  const handleSubTap = (idx: number) => {
    if (selectedSubIdx === null) {
      setSelectedSubIdx(idx); 
    } else if (selectedSubIdx === idx) {
      setSelectedSubIdx(null); 
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const newList = [...dynamicSubTypes];
      const temp = newList[selectedSubIdx];
      newList[selectedSubIdx] = newList[idx];
      newList[idx] = temp;
      setDynamicSubTypes(newList);
      setSelectedSubIdx(null);
    }
  };

  // 8. Fix: Sequential Saving to prevent Database Rate Limit Errors
  async function saveGlobalSortOrder() {
    if(!supabase) return; setSavingSort(true);
    try {
      // વારાફરતી મુખ્ય કેટેગરી સેવ કરો
      for (let i = 0; i < dynamicMainTypes.length; i++) {
        await supabase!.from('menu_items').update({ main_sort: i }).eq('main_type', dynamicMainTypes[i]);
      }
      // વારાફરતી સબ કેટેગરી સેવ કરો
      for (let i = 0; i < dynamicSubTypes.length; i++) {
        await supabase!.from('menu_items').update({ sub_sort: i }).eq('sub_category', dynamicSubTypes[i]);
      }

      await fetchMenu();
      setShowCatManager(false);
      showMsg('સફળતા 🎉', 'ક્રમ ડેટાબેઝમાં કાયમી સેવ થઈ ગયો છે અને આખી એપમાં અપડેટ થઈ ગયો છે!');
    } catch (e: any) { showMsg('Error', e.message); } finally { setSavingSort(false); }
  }

  async function toggleStatus(id: string, current: boolean) { await supabase!.from('menu_items').update({ is_active: !current }).eq('id', id); fetchMenu(); }
  async function deleteMenu(id: string) {
    if (Platform.OS === 'web') { if (window.confirm('આ વાનગી કાઢી નાખવી છે?')) { await supabase!.from('menu_items').delete().eq('id', id); fetchMenu(); } return; }
    Alert.alert('કન્ફર્મ કરો', 'આ વાનગી કાઢી નાખવી છે?', [ { text: 'ના'}, { text: 'હા', style: 'destructive', onPress: async () => { await supabase!.from('menu_items').delete().eq('id', id); fetchMenu(); }}]);
  }

  const filteredMenuItems = menuItems.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <View style={s.p18}>
      <Pressable onPress={onBack} style={s.backButton}><Text style={s.backText}>‹ પાછા</Text></Pressable>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, flexWrap:'wrap', gap:10}}>
        <Text style={s.h1}>મેનૂ મેનેજમેન્ટ</Text>
        <Pressable onPress={()=>setShowCatManager(true)} style={[s.refreshBtn, {backgroundColor: '#1e293b'}]}><Text style={[s.refreshBtnText, {color: '#fff'}]}>⚙️ કેટેગરીનો ક્રમ બદલો (Sort)</Text></Pressable>
      </View>

      <View style={s.formCard}>
        <Text style={s.sectionTitle}>{editingId ? 'વાનગી એડિટ કરો' : 'નવી વાનગી ઉમેરો'}</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="વાનગીનું નામ (દા.ત. રોટલી)" />
        <Dropdown label="કયા જમણવારમાં ઉમેરવી છે?" options={dynamicMainTypes.map(t => ({label: t, value: t}))} selectedValue={mainType} onSelect={setMainType} />
        <Dropdown label="વાનગીનો પ્રકાર (કેટેગરી)" options={dynamicSubTypes.map(t => ({label: t, value: t}))} selectedValue={subCategory} onSelect={setSubCategory} />
        <TextInput style={s.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="સેવા રાશી (₹)" onSubmitEditing={saveMenu} />
        <Pressable onPress={saveMenu} style={s.primary}><Text style={s.primaryText}>{editingId ? 'ફેરફાર સેવ કરો' : '＋ વાનગી ઉમેરો'}</Text></Pressable>
        {editingId && <Pressable onPress={()=>{setEditingId(null); setName(''); setPrice('');}} style={s.closeButton}><Text>કેન્સલ એડિટિંગ</Text></Pressable>}
      </View>
      
      <Text style={[s.h1, {marginTop: 20}]}>તમામ મેનૂ</Text>
      <TextInput style={[s.input, {borderColor: '#047857', borderWidth: 2}]} placeholder="🔍 વાનગીનું નામ શોધો..." value={searchQuery} onChangeText={setSearchQuery} />

      {dynamicMainTypes.map(type => {
        const itemsInType = filteredMenuItems.filter(m => m.main_type === type);
        if (itemsInType.length === 0) return null;
        return (
          <View key={type} style={{marginBottom: 20}}>
            <Text style={s.mainTypeHeader}>{type}</Text>
            {dynamicSubTypes.map(sub => {
              const itemsInSub = itemsInType.filter(m => m.sub_category === sub);
              if (itemsInSub.length === 0) return null;
              const isExpanded = expandedSubs[`${type}_${sub}`] || searchQuery.length > 0;
              return (
                <View key={sub} style={{marginLeft: 10, marginBottom: 10}}>
                  <Pressable onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpandedSubs(p=>({...p, [`${type}_${sub}`]:!p[`${type}_${sub}`]})) }} style={s.collapsibleHeader}>
                     <Text style={s.collapsibleHeaderText}>{sub} ({itemsInSub.length})</Text>
                     <Text style={s.collapsibleHeaderIcon}>{isExpanded ? '▲' : '▼'}</Text>
                  </Pressable>
                  {isExpanded && (
                    <View style={{paddingLeft: 10, paddingTop: 10}}>
                      {itemsInSub.map(m => (
                        <View key={m.id} style={s.listCard}>
                          <View style={{flex:1}}><Text style={{fontWeight:'bold', color: m.is_active?'#1e293b':'#94a3b8', textDecorationLine: m.is_active?'none':'line-through'}}>{m.name}</Text><Text style={{color:'#047857', fontWeight:'bold', marginTop: 2}}>સેવા: ₹{m.price}</Text></View>
                          <View style={{alignItems: 'flex-end', gap: 6}}>
                             <View style={[s.statusBadge, {backgroundColor: m.is_active ? '#f0fdf4' : '#fef2f2'}]}><Text style={{color: m.is_active ? '#047857' : '#dc2626', fontWeight:'bold', fontSize: 12}}>{m.is_active ? 'Active' : 'Inactive'}</Text></View>
                             <View style={{flexDirection:'row', gap: 5}}>
                              <Pressable onPress={() => {setEditingId(m.id); setName(m.name); setMainType(m.main_type); setSubCategory(m.sub_category||''); setPrice(m.price.toString()); setExpandedSubs({[`${m.main_type}_${m.sub_category}`]: true});}} style={s.editBtn}><Text>✏️</Text></Pressable>
                              <Pressable onPress={() => toggleStatus(m.id, m.is_active)} style={s.editBtn}><Text style={s.editBtnText}>{m.is_active ? 'બંધ' : 'ચાલુ'}</Text></Pressable>
                              <Pressable onPress={() => deleteMenu(m.id)} style={[s.editBtn, {backgroundColor: '#fef2f2', borderColor: '#fca5a5'}]}><Text style={{color:'#dc2626'}}>🗑️</Text></Pressable>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}

      <Modal visible={showCatManager} animationType="slide">
        <SafeAreaView style={s.safe}>
           <View style={[s.header, {paddingTop: Platform.OS==='web'?20:0}]}><Text style={s.h1}>કેટેગરીનો ક્રમ બદલો</Text><Pressable onPress={()=>{setShowCatManager(false); setSelectedMainIdx(null); setSelectedSubIdx(null);}}><Text style={{fontSize:24, color:'#64748b'}}>✕</Text></Pressable></View>
           <ScrollView contentContainerStyle={[s.webContainer, s.p18]}>
              
              <Text style={{textAlign: 'center', backgroundColor: '#e0f2fe', padding: 10, borderRadius: 10, color: '#0369a1', fontWeight: 'bold', marginBottom: 20}}>
                 💡 સ્માર્ટ સ્વેપ: જેનો ક્રમ બદલવો હોય તેના પર ૧ વાર ક્લિક કરો, અને પછી બીજી જગ્યાએ ક્લિક કરો એટલે જગ્યા બદલાઈ જશે. 
              </Text>

              <View style={s.formCard}>
                <Text style={s.sectionTitle}>જમણવાર ના પ્રકાર</Text>
                {dynamicMainTypes.map((t, idx) => (
                  <Pressable 
                     key={t} 
                     onPress={() => handleMainTap(idx)}
                     style={[s.dragItem, selectedMainIdx === idx && s.dragging]}
                  >
                    <Text style={s.dragHandle}>{selectedMainIdx === idx ? '🔄' : '👆'}</Text>
                    <Text style={{fontSize:16, fontWeight:'bold', color: selectedMainIdx === idx ? '#0369a1' : '#1e293b', flex: 1}}>{idx + 1}. {t}</Text>
                    {selectedMainIdx === idx && <Text style={{fontSize: 12, fontWeight: 'bold', color: '#047857'}}>અહીં મૂકવા બીજી જગ્યા પસંદ કરો</Text>}
                  </Pressable>
                ))}
              </View>

              <View style={[s.formCard, {marginTop: 20}]}>
                <Text style={s.sectionTitle}>વાનગી ના પ્રકાર</Text>
                {dynamicSubTypes.map((t, idx) => (
                  <Pressable 
                     key={t} 
                     onPress={() => handleSubTap(idx)}
                     style={[s.dragItem, selectedSubIdx === idx && s.dragging]}
                  >
                    <Text style={s.dragHandle}>{selectedSubIdx === idx ? '🔄' : '👆'}</Text>
                    <Text style={{fontSize:16, fontWeight:'bold', color: selectedSubIdx === idx ? '#0369a1' : '#1e293b', flex: 1}}>{idx + 1}. {t}</Text>
                    {selectedSubIdx === idx && <Text style={{fontSize: 12, fontWeight: 'bold', color: '#047857'}}>અહીં મૂકવા બીજી જગ્યા પસંદ કરો</Text>}
                  </Pressable>
                ))}
              </View>

              <Pressable disabled={savingSort} onPress={saveGlobalSortOrder} style={({pressed}) => [s.saveBtn, {marginTop: 30, paddingVertical: 20}, pressed && {opacity: 0.8}]}>
                 <Text style={{color: '#fff', fontSize: 18, fontWeight: '900'}}>{savingSort ? 'સેવ થઈ રહ્યું છે...' : '💾 ફાઇનલ ક્રમ સેવ કરો'}</Text>
              </Pressable>
              
           </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ================= ADMIN PLACES & USERS (100% RESTORED) =================
function AdminPlacesScreen({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState(''); const [places, setPlaces] = useState<any[]>([]); const [editingId, setEditingId] = useState<string | null>(null);
  useEffect(() => { fetchPlaces(); }, []);
  async function fetchPlaces() { if (!supabase) return; const { data } = await supabase.from('places').select('*').order('created_at', { ascending: true }); if (data) setPlaces(data); }
  async function savePlace() {
    if (!name.trim() || !supabase) return showMsg('Error', 'સ્થળનું નામ લખો');
    if (editingId) await supabase.from('places').update({ name: name.trim() }).eq('id', editingId); else await supabase.from('places').insert([{ name: name.trim(), is_active: true }]);
    setName(''); setEditingId(null); fetchPlaces();
  }
  return (
    <View style={s.p18}>
      <Pressable onPress={onBack} style={s.backButton}><Text style={s.backText}>‹ પાછા</Text></Pressable>
      <Text style={s.h1}>સ્થળ મેનેજમેન્ટ</Text>
      <View style={s.formCard}><TextInput style={s.input} value={name} onChangeText={setName} placeholder="સ્થળનું નામ" onSubmitEditing={savePlace} /><Pressable onPress={savePlace} style={s.primary}><Text style={s.primaryText}>સેવ કરો</Text></Pressable></View>
      {places.map(p => (
        <View key={p.id} style={s.listCard}><Text style={{fontWeight:'bold', fontSize: 16}}>{p.name}</Text><Pressable onPress={() => {setEditingId(p.id); setName(p.name);}} style={s.editBtn}><Text>✏️</Text></Pressable></View>
      ))}
    </View>
  );
}

function AdminUsersScreen({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<any[]>([]); 
  const [places, setPlaces] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false); 
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState(''); const [mobile, setMobile] = useState(''); const [role, setRole] = useState<Role>('counter');
  const [selectedDutyPlaces, setSelectedDutyPlaces] = useState<string[]>([]); 
  const [loginEmail, setLoginEmail] = useState(''); const [loginPass, setLoginPass] = useState('');

  useEffect(() => { fetchData(); }, []);
  
  async function fetchData() { 
    if (!supabase) return; 
    const { data: uData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }); 
    const { data: pData } = await supabase.from('places').select('*').eq('is_active', true);
    
    if (uData) {
       const mappedUsers = uData.map(u => {
          let pList: string[] = [];
          if (u.duty_places) {
             if(Array.isArray(u.duty_places)) pList = u.duty_places;
             else if(typeof u.duty_places === 'string') { try { pList = JSON.parse(u.duty_places); } catch(e) { pList = [u.duty_places]; } }
          } else if (u.duty_place) { pList = [u.duty_place]; }
          return {...u, duty_places: pList};
       });
       setUsers(mappedUsers); 
    }
    if (pData) setPlaces(pData);
  }

  function openEdit(u: any) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditingId(u.id); setName(u.full_name || ''); setMobile(u.mobile || '');
    setRole(u.role); setSelectedDutyPlaces(u.duty_places || []); 
    setLoginEmail(u.login_email || ''); 
    // 3. Populate current saved password when editing
    setLoginPass(u.login_pass || '');
    setShowForm(true);
  }
  
  async function deleteUser(id: string) { 
    if(Platform.OS==='web') { if(window.confirm('આ યુઝર કાઢી નાખવો છે?')){ await supabase!.from('profiles').delete().eq('id', id); fetchData();} } 
    else { Alert.alert('કન્ફર્મ કરો', 'આ યુઝર કાઢી નાખવો છે?', [{text:'ના'}, {text:'હા', style: 'destructive', onPress:async ()=>{await supabase!.from('profiles').delete().eq('id', id); fetchData();}}]); } 
  }
  
  // 2. Active/Deactive Toggle
  async function toggleStatus(id: string, currentStatus: boolean) {
     if(!supabase) return;
     try {
       await supabase.from('profiles').update({ is_active: !currentStatus }).eq('id', id);
       fetchData();
     } catch(e: any) { showMsg('Error', e.message); }
  }
  
  async function saveUser() {
    if (!name || !loginEmail || (!loginPass && !editingId)) return showMsg('ભૂલ ❌', 'નામ, યુઝર ID અને પાસવર્ડ ફરજિયાત છે.');
    if (role === 'counter' && selectedDutyPlaces.length === 0) return showMsg('ભૂલ ❌', 'કેશ કાઉન્ટર માટે ઓછામાં ઓછું એક સ્થળ પસંદ કરવું ફરજિયાત છે.');
    if (!supabase) return;
    
    setSaving(true);
    const authEmail = loginEmail.includes('@') ? loginEmail.toLowerCase() : `${loginEmail.toLowerCase()}@baps.local`;
    const payload: any = { full_name: name, mobile, role, duty_places: selectedDutyPlaces, login_email: loginEmail, is_active: true };
    
    if (editingId) {
      if (loginPass) payload.login_pass = loginPass;
      const { error } = await supabase.from('profiles').update(payload).eq('id', editingId);
      setSaving(false);
      if(error) showMsg('ભૂલ ❌', error.message);
      else { showMsg('સફળતા 🎉', 'યુઝરની ડિટેલ અપડેટ થઈ ગઈ!'); setShowForm(false); setEditingId(null); fetchData(); }
    } else {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) { setSaving(false); return showMsg('સેશન એક્સપાયર', 'લૉગિન સેશન પૂરું થઈ ગયું છે, ફરીથી લૉગિન કરો.'); }
        const response = await fetch('https://ooeecqioprwverlpdjqe.supabase.co/functions/v1/create-auth-user', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ email: authEmail, password: loginPass, full_name: name, mobile: mobile || "", role: role })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'યુઝર બનાવવામાં ભૂલ આવી');
        await supabase.from('profiles').update({ duty_places: selectedDutyPlaces, login_email: loginEmail, login_pass: loginPass }).eq('id', result.user.id);
        setSaving(false); showMsg('સફળતા 🎉', 'નવો યુઝર સફળતાપૂર્વક બની ગયો!'); setShowForm(false); setEditingId(null); fetchData();
      } catch (err: any) { setSaving(false); showMsg('ભૂલ ❌', err.message); }
    }
  }

  function togglePlaceSelection(placeId: string) {
    if (selectedDutyPlaces.includes(placeId)) setSelectedDutyPlaces(selectedDutyPlaces.filter(id => id !== placeId));
    else setSelectedDutyPlaces([...selectedDutyPlaces, placeId]);
  }

  return (
    <View style={s.p18}>
      <Pressable onPress={onBack} style={s.backButton}><Text style={s.backText}>‹ પાછા સેટિંગ્સ પર</Text></Pressable>
      <Text style={s.h1}>યુઝર મેનેજમેન્ટ</Text>
      
      {showForm ? (
        <View style={s.formCard}>
          <Text style={s.sectionTitle}>{editingId ? 'યુઝર એડિટ કરો' : 'નવો યુઝર ઉમેરો'}</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="યુઝરનું નામ" />
          <TextInput style={s.input} value={mobile} onChangeText={setMobile} placeholder="મોબાઈલ નંબર" keyboardType="phone-pad" />
          <Dropdown label="રોલ (Role)" options={[{label:'Super Admin', value:'super_admin'}, {label:'Admin', value:'admin'}, {label:'Cash Counter', value:'counter'}, {label:'Production (રસોડું)', value:'production'}, {label:'Dispatch', value:'dispatch'}]} selectedValue={role} onSelect={setRole} />
          
          <Text style={s.label}>આ યુઝર માટે કયા સ્થળ માન્ય છે? (એકથી વધુ સિલેક્ટ કરી શકાય)</Text>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15, padding: 10, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0'}}>
             {places.map(p => {
                 const isSelected = selectedDutyPlaces.includes(p.id);
                 return ( <Pressable key={p.id} onPress={() => togglePlaceSelection(p.id)} style={[s.chip, isSelected && s.chipSelected]}><Text style={[s.chipText, isSelected && s.chipTextSelected]}>{p.name}</Text></Pressable> )
             })}
          </View>
          
          <Text style={[s.sectionTitle, {marginTop: 15}]}>લોગિન માટેની વિગતો</Text>
          <TextInput style={s.input} value={loginEmail} onChangeText={setLoginEmail} placeholder="યુઝર ID (દા.ત. Rasodu1)" autoCapitalize="none" />
          <TextInput style={s.input} value={loginPass} onChangeText={setLoginPass} placeholder="લોગિન પાસવર્ડ" onSubmitEditing={saveUser} returnKeyType="done" />

          <Pressable disabled={saving} onPress={saveUser} style={({pressed}) => [s.primary, saving && {opacity: 0.7}, pressed && {opacity: 0.8}]}><Text style={s.primaryText}>{saving ? 'સેવ થઈ રહ્યું છે...' : 'યુઝર સેવ કરો (Enter)'}</Text></Pressable>
          <Pressable disabled={saving} onPress={() => {LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowForm(false); setEditingId(null);}} style={[s.closeButton, {marginTop: 5}]}><Text style={s.closeText}>કેન્સલ</Text></Pressable>
        </View>
      ) : (
        <Pressable onPress={() => {LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setEditingId(null); setName(''); setMobile(''); setLoginEmail(''); setLoginPass(''); setSelectedDutyPlaces([]); setShowForm(true);}} style={({pressed}) => [s.primary, {backgroundColor: '#4f46e5'}, pressed && {opacity:0.8}]}><Text style={s.primaryText}>＋ નવો યુઝર બનાવો</Text></Pressable>
      )}

      <Text style={[s.sectionTitle, {marginTop: 20}]}>સ્ટાફ લિસ્ટ</Text>
      {users.map(u => {
          const placeNames = (u.duty_places || []).map((id:string) => places.find(p=>p.id===id)?.name || 'Unknown').join(', ');
          return (
            <View key={u.id} style={s.listCard}>
              <View style={{flex: 1}}>
                <Text style={{fontWeight:'bold', fontSize:16, color: '#1e293b'}}>{u.full_name || 'No Name'}</Text>
                <Text style={{color:'#64748b', fontSize: 13, marginTop: 4}}>ID: <Text style={{fontWeight: 'bold', color: '#1e293b'}}>{u.login_email}</Text> • {roleLabel[u.role as Role]}</Text>
                {placeNames ? <Text style={{color:'#0369a1', fontSize: 12, fontWeight: 'bold', marginTop: 4}}>📍 {placeNames}</Text> : null}
              </View>
              <View style={{alignItems: 'flex-end', gap: 6}}>
                <View style={[s.statusBadge, {backgroundColor: u.is_active ? '#f0fdf4' : '#fef2f2'}]}><Text style={{color: u.is_active ? '#047857' : '#dc2626', fontWeight:'bold', fontSize: 12}}>{u.is_active ? 'Active' : 'Inactive'}</Text></View>
                <View style={{flexDirection: 'row', gap: 5}}>
                  <Pressable onPress={() => openEdit(u)} style={({pressed})=> [s.editBtn, pressed && {backgroundColor:'#f1f5f9'}]}><Text style={s.editBtnText}>✏️ એડિટ</Text></Pressable>
                  {/* 2. Restored Active/Deactive Button */}
                  <Pressable onPress={() => toggleStatus(u.id, u.is_active)} style={({pressed})=> [s.editBtn, pressed && {backgroundColor:'#f1f5f9'}]}><Text style={s.editBtnText}>{u.is_active ? 'બંધ' : 'ચાલુ'}</Text></Pressable>
                  <Pressable onPress={() => deleteUser(u.id)} style={({pressed})=> [s.editBtn, {backgroundColor: '#fef2f2', borderColor: '#fca5a5'}, pressed && {backgroundColor:'#fee2e2'}]}><Text style={{color:'#dc2626'}}>🗑️</Text></Pressable>
                </View>
              </View>
            </View>
          );
      })}
    </View>
  );
}

// ================= COUNTER & ALL BOOKINGS =================
function CounterHome({ session, profile }: { session: Session, profile: Profile }) {
  const [activeTab, setActiveTab] = useState<'home'|'new_booking'|'all_bookings'>('home');
  const [stats, setStats] = useState({ count: 0, lifetimeGuests: 0 }); 
  const [todaysMeals, setTodaysMeals] = useState<any[]>([]);
  const [todayData, setTodayData] = useState({ total: 0, mealMap: {} as any });
  const [tomorrowData, setTomorrowData] = useState({ total: 0, mealMap: {} as any });
  const [places, setPlaces] = useState<any[]>([]); const { sortedMains } = useSortedCategories();
  const [refreshing, setRefreshing] = useState(false); const [editingBooking, setEditingBooking] = useState<any>(null);

  const myDutyPlaces = profile.duty_places || [];

  useEffect(() => { if (activeTab === 'home') fetchDashboard(); }, [activeTab]);

  async function fetchDashboard() {
    if (!supabase) return; setRefreshing(true);
    try {
      let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });
      if (myDutyPlaces.length > 0) query = query.or(myDutyPlaces.map(p => `place_id.eq.${p}`).join(','));
      const { data } = await query; const { data: pData } = await supabase.from('places').select('*');
      if (data) {
        let totalAllGuests = 0; 
        const tStr = getTodayStr(); const tomStr = getTomorrowStr();
        let tData = { total: 0, mealMap: {} as any }; let tomData = { total: 0, mealMap: {} as any };
        data.forEach(b => {
          if (b.meals) {
            b.meals.forEach((m: any) => {
              const g = m.guestsCount || 0; totalAllGuests += g;
              const hostName = `${b.name || ''}`.trim() || 'અજ્ઞાત યજમાન';
              if (m.date === tStr) { tData.total += g; if(!tData.mealMap[m.mainType]) tData.mealMap[m.mainType] = { count: 0, hosts: [] }; tData.mealMap[m.mainType].count += g; tData.mealMap[m.mainType].hosts.push(`${hostName} (${g})`); }
              if (m.date === tomStr) { tomData.total += g; if(!tomData.mealMap[m.mainType]) tomData.mealMap[m.mainType] = { count: 0, hosts: [] }; tomData.mealMap[m.mainType].count += g; tomData.mealMap[m.mainType].hosts.push(`${hostName} (${g})`); }
            });
          }
        });
        setStats({ count: data.length, lifetimeGuests: totalAllGuests });
        setTodayData(tData); setTomorrowData(tomData);
        setTodaysMeals(data.filter(b => b.meals?.some((m:any) => m.date === tStr))); 
      }
      if (pData) setPlaces(pData);
    } catch (err: any) { showMsg('Error', err.message); } finally { setRefreshing(false); }
  }

  if (editingBooking) return <BookingScreen onBack={() => { setEditingBooking(null); fetchDashboard(); }} session={session} profile={profile} initialData={editingBooking} allowedPlaces={places.filter(p=>myDutyPlaces.includes(p.id))} />;
  if (activeTab === 'new_booking') return <BookingScreen onBack={() => {setActiveTab('home'); fetchDashboard();}} session={session} profile={profile} allowedPlaces={places.filter(p=>(profile.duty_places||[]).includes(p.id))} />;
  if (activeTab === 'all_bookings') return <AllBookingsScreen onBack={() => {setActiveTab('home'); fetchDashboard();}} session={session} profile={profile} isAdmin={false} />;

  return (
    <View style={s.p18}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, flexWrap: 'wrap', gap: 10}}>
         <Text style={s.h1}>કેશ કાઉન્ટર ડેશબોર્ડ</Text>
         <Pressable onPress={fetchDashboard} style={s.refreshBtn}><Text style={s.refreshBtnText}>{refreshing ? 'Loading...' : '🔄 રિફ્રેશ'}</Text></Pressable>
      </View>
      
      <View style={s.grid}>
        <Card title="તમારા સ્થળના કુલ બુકિંગ્સ" icon="📋" value={stats.count.toString()} />
        <Card title="કુલ યજમાનોની સંખ્યા" icon="👥" value={stats.lifetimeGuests.toString()} />
      </View>

      <PreviewWidget title="🍽️ આજના યજમાનો" dateStr={getTodayStr()} data={todayData} bgColor="#f0fdf4" borderColor="#6ee7b7" sortOrder={sortedMains} />
      <PreviewWidget title="🍽️ આવતીકાલના યજમાનો" dateStr={getTomorrowStr()} data={tomorrowData} bgColor="#fffbeb" borderColor="#fde047" sortOrder={sortedMains} />
      
      <Pressable onPress={() => setActiveTab('new_booking')} style={({pressed}) => [s.primary, {marginBottom: 20}, pressed && {opacity: 0.8}]}><Text style={s.primaryText}>＋ નવી બુકિંગ બનાવો</Text></Pressable>

      <Text style={[s.sectionTitle, {marginTop: 10}]}>આજની તારીખના બુકિંગ્સ ({todaysMeals.length})</Text>
      {todaysMeals.map(b => <BookingCard key={b.id} b={b} places={places} isAdmin={false} onEdit={setEditingBooking} /> )}
      
      <Pressable onPress={() => setActiveTab('all_bookings')} style={({pressed}) => [s.primary, {backgroundColor: '#ffffff', borderWidth: 2, borderColor:'#047857', borderStyle:'dashed', marginTop: 12}, pressed && {backgroundColor: '#f1f5f9'}]}><Text style={{color:'#047857', fontWeight:'bold', fontSize: 16}}>📋 બધા બુકિંગ્સ જુઓ (View All)</Text></Pressable>

    </View>
  );
}

function AllBookingsScreen({ onBack, session, profile, isAdmin }: { onBack: () => void, session: Session, profile: Profile, isAdmin: boolean }) {
  const [bookings, setBookings] = useState<any[]>([]); const [places, setPlaces] = useState<any[]>([]);
  const [editingBooking, setEditingBooking] = useState<any>(null);

  useEffect(() => { fetchBookings(); }, []);
  async function fetchBookings() {
    if (!supabase) return;
    try {
      let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });
      if (profile.role === 'counter' && profile.duty_places && profile.duty_places.length > 0) query = query.or(profile.duty_places.map(p => `place_id.eq.${p}`).join(','));
      const { data } = await query; const { data: pData } = await supabase.from('places').select('*');
      if (data) setBookings(data.sort((a,b) => (b.meals?.[0]?.date?.split('-').reverse().join('') || '0').localeCompare(a.meals?.[0]?.date?.split('-').reverse().join('') || '0')));
      if (pData) setPlaces(pData);
    } catch(err: any) { showMsg('Fetch Error', err.message); }
  }

  const allowedPlaces = (profile.role === 'counter') ? places.filter(p=> (profile.duty_places || []).includes(p.id)) : places;
  
  if (editingBooking) return <BookingScreen onBack={() => { setEditingBooking(null); fetchBookings(); }} session={session} profile={profile} initialData={editingBooking} allowedPlaces={allowedPlaces} />;

  return (
    <View style={s.p18}>
      <Pressable onPress={onBack} style={s.backButton}><Text style={s.backText}>‹ પાછા ડેશબોર્ડ પર</Text></Pressable>
      <Text style={s.h1}>બધા બુકિંગ્સ</Text>
      {bookings.length === 0 ? <Text style={s.muted}>કોઈ બુકિંગ નથી.</Text> : null}
      {bookings.map(b => <BookingCard key={b.id} b={b} places={places} isAdmin={isAdmin} onEdit={setEditingBooking} fetchBookings={fetchBookings} />)}
    </View>
  );
}

// ================= PRODUCTION (રસોડું) MODULE =================
function ProductionHome() {
  const [loading, setLoading] = useState(true); const [prodDate, setProdDate] = useState<'today'|'tomorrow'>('today'); 
  const [menuAggregates, setMenuAggregates] = useState<any>({}); const [totalGuests, setTotalGuests] = useState(0);
  const targetDateStr = prodDate === 'today' ? getTodayStr() : getTomorrowStr();
  const { sortedMains, sortedSubs } = useSortedCategories();

  useEffect(() => { fetchProductionData(); }, [prodDate]);

  async function fetchProductionData() {
    setLoading(true); if (!supabase) return;
    try {
      const { data } = await supabase.from('bookings').select('*'); const { data: pData } = await supabase.from('places').select('*');
      if (data) {
        let agg: any = {}; let tGuests = 0;
        data.forEach(b => {
          let pName = pData?.find((p:any) => p.id === b.place_id)?.name || 'અન્ય સ્થળ';
          if (!agg[pName]) agg[pName] = {};
          if (b.meals) {
            b.meals.forEach((m: any) => {
              if (m.date === targetDateStr) {
                const gCount = m.guestsCount || 0; tGuests += gCount;
                if (!agg[pName][m.mainType]) agg[pName][m.mainType] = {};
                m.items?.forEach((i: any) => {
                  const sub = i.sub_category || 'અન્ય';
                  if (!agg[pName][m.mainType][sub]) agg[pName][m.mainType][sub] = {};
                  if (!agg[pName][m.mainType][sub][i.name]) agg[pName][m.mainType][sub][i.name] = 0;
                  agg[pName][m.mainType][sub][i.name] += gCount; 
                });
              }
            });
          }
        });
        setMenuAggregates(agg); setTotalGuests(tGuests);
      }
    } catch (err: any) { showMsg('Error', err.message); } finally { setLoading(false); }
  }

  if (loading) return <LoadingScreen />;

  return (
    <View style={s.p18}>
      <Text style={{fontSize: 26, fontWeight: '900', color: '#047857', marginBottom: 15}}>👨‍🍳 રસોડા વિભાગ (KDS)</Text>
      <View style={s.prodTabBar}>
         <Pressable onPress={()=>setProdDate('today')} style={[s.prodTabBtn, prodDate==='today' && s.prodTabBtnActive]}><Text style={[s.prodTabBtnText, prodDate==='today' && s.prodTabBtnTextActive]}>📅 આજનું મેનૂ</Text></Pressable>
         <Pressable onPress={()=>setProdDate('tomorrow')} style={[s.prodTabBtn, prodDate==='tomorrow' && s.prodTabBtnActive]}><Text style={[s.prodTabBtnText, prodDate==='tomorrow' && s.prodTabBtnTextActive]}>📅 કાલનું મેનૂ</Text></Pressable>
      </View>
      <View style={[s.todayGuestsCard, {backgroundColor: prodDate === 'today' ? '#f0fdf4' : '#fffbeb', borderColor: prodDate === 'today' ? '#6ee7b7' : '#fde047'}]}>
         <Text style={{fontSize: 16, fontWeight: '900', color: '#065f46'}}>{prodDate === 'today' ? 'આજનો' : 'આવતીકાલનો'} કુલ અંદાજિત જમણવાર: <Text style={{fontSize: 22}}>{totalGuests} લોકો</Text></Text>
      </View>
      <View style={{gap: 20}}>
        {Object.keys(menuAggregates).length === 0 ? ( <Text style={s.muted}>આ દિવસે કોઈ મેનૂ બનાવવા માટે નથી.</Text> ) : (
          Object.keys(menuAggregates).map(place => (
            <View key={place} style={{backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 2, borderColor: '#047857', marginBottom: 15}}>
              <Text style={{fontSize: 22, fontWeight: '900', color: '#1e3a8a', backgroundColor: '#e0f2fe', padding: 10, borderRadius: 10, textAlign: 'center', marginBottom: 15}}>📍 {place}</Text>
              
              {Object.keys(menuAggregates[place]).sort((a,b)=> { let iA = sortedMains.indexOf(a); let iB = sortedMains.indexOf(b); return (iA===-1?999:iA) - (iB===-1?999:iB); }).map(type => (
                <View key={type} style={{marginBottom: 15, padding: 12, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0'}}>
                  <Text style={{fontSize: 18, fontWeight: '900', color: '#047857', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 6, marginBottom: 8}}>{type}</Text>
                  
                  {Object.keys(menuAggregates[place][type]).sort((a,b)=> { let iA = sortedSubs.indexOf(a); let iB = sortedSubs.indexOf(b); return (iA===-1?999:iA) - (iB===-1?999:iB); }).map(sub => (
                    <View key={sub} style={{marginBottom: 10}}>
                      <Text style={{fontSize: 14, fontWeight: 'bold', color: '#b91c1c', marginBottom: 6}}>{sub}</Text>
                      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12}}>
                        {Object.keys(menuAggregates[place][type][sub]).map(itemName => (
                          <View key={itemName} style={{backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1'}}><Text style={{fontSize: 14, fontWeight: 'bold', color: '#1e293b'}}>{itemName}</Text><Text style={{fontSize: 16, fontWeight: '900', color: '#d97706', marginTop: 2}}>{menuAggregates[place][type][sub][itemName]} <Text style={{fontSize: 12, color: '#64748b'}}>લોકો</Text></Text></View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

// ================= BOOKING COMPONENTS & UTILS =================
function BookingCard({ b, places, isAdmin, onEdit, fetchBookings }: any) {
  const placeName = places.find((p:any) => p.id === b.place_id)?.name || 'સ્થળ નથી';
  
  // 5. Booking Delete function
  async function handleDelete() {
    if(Platform.OS==='web') { if(window.confirm('ખરેખર આ બુકિંગ કાઢી નાખવું છે?')){ await supabase!.from('bookings').delete().eq('id', b.id); if(fetchBookings) fetchBookings(); } }
    else { Alert.alert('કન્ફર્મ કરો', 'ખરેખર આ બુકિંગ કાઢી નાખવું છે?', [{text:'ના'}, {text:'હા, કાઢી નાખો', style: 'destructive', onPress:async ()=>{await supabase!.from('bookings').delete().eq('id', b.id); if(fetchBookings) fetchBookings(); }}]); }
  }

  // 7. Professional WhatsApp Message Logic
  function sendWhatsApp() {
     if(!b.mobile) return showMsg('ભૂલ', 'મોબાઈલ નંબર નથી');
     let mealDetails = '';
     if (b.meals) {
        b.meals.forEach((m: any, idx: number) => {
           mealDetails += `${idx + 1}. ${m.mainType} (${m.guestsCount} લોકો)\n  તારીખ: ${m.date}  |  સમય: ${m.time}\n  સ્થળ: ${placeName}\n\n`;
        });
     }
     
     const message = `જય સ્વામિનારાયણ! 🙏\nBAPS રાજકોટ (રસોઈ સેવા વિભાગ) તરફથી આપનું બુકિંગ કન્ફર્મ થઈ ગયું છે.\n\nયજમાન: ${b.name} ${b.surname || ''}\nમોબાઈલ: ${b.mobile}\n\nજમણવારની વિગત:\n${mealDetails}નોંધ: BAPS સ્વામિનારાયણ મંદિરે પહોંચી ગેટ નંબર 8 થી પ્રવેશીને આપના વાહન સેલર પાર્કિંગમાં પાર્ક કરવા નમ્ર વિનંતી.`;
     const encodedMessage = encodeURIComponent(message);
     Linking.openURL(`https://wa.me/91${b.mobile}?text=${encodedMessage}`);
  }

  return (
    <View style={s.bookingCard}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10, marginBottom: 10}}>
        <View style={{flex: 1}}>
          <Text style={{fontWeight:'900', fontSize: 18, color: '#1e293b'}}>{b.name} {b.surname || ''}</Text>
          {b.mobile ? ( 
             <View style={{flexDirection: 'row', gap: 15, alignItems: 'center', marginTop: 6}}>
                <Pressable onPress={() => Linking.openURL(`tel:${b.mobile}`)}><Text style={{color: '#0284c7', fontWeight: 'bold', fontSize: 14, textDecorationLine: 'underline'}}>📞 {b.mobile}</Text></Pressable>
                {/* 6. Restored WhatsApp Button */}
                <Pressable onPress={sendWhatsApp} style={{backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12}}><Text style={{color: '#fff', fontWeight: 'bold', fontSize: 12}}>💬 WhatsApp</Text></Pressable>
             </View>
          ) : null}
        </View>
        <View style={{alignItems: 'flex-end'}}><Text style={s.statusBadgeText}>{b.payment_status}</Text><Text style={{color: '#64748b', fontSize: 12, marginTop: 6, fontWeight: 'bold'}}>પહોંચ: {b.receipt_no || '-'}</Text></View>
      </View>
      {b.meals?.map((m: any, idx: number) => (
        <View key={idx} style={s.mealBox}>
          <Text style={{fontWeight: 'bold', color: '#1e3a8a', fontSize: 14}}>🗓️ {m.date} • ⏰ {m.time}</Text>
          <Text style={{fontWeight: '700', marginTop: 4, color: '#334155'}}>📍 {placeName} • {m.mainType} ({m.guestsCount} લોકો)</Text>
          <Text style={{color: '#64748b', fontSize: 13, marginTop: 2}}>🍽️ {m.items?.map((i:any)=> i.name ? i.name : i).join(', ')}</Text>
        </View>
      ))}
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12}}>
        <Text style={{color:'#d97706', fontWeight:'900', fontSize: 17}}>{isAdmin ? `💰 કુલ સેવા: ₹${b.grand_total?.toLocaleString()}` : ''}</Text>
        <View style={{flexDirection: 'row', gap: 8}}>
           <Pressable onPress={() => onEdit(b)} style={({pressed}) => [s.editBtn, pressed && {backgroundColor: '#f1f5f9'}]}><Text style={s.editBtnText}>✏️ એડિટ</Text></Pressable>
           {isAdmin && (
              <Pressable onPress={handleDelete} style={({pressed}) => [s.editBtn, {backgroundColor: '#fef2f2', borderColor: '#fca5a5'}, pressed && {backgroundColor: '#fee2e2'}]}><Text style={{color:'#dc2626'}}>🗑️ ડિલીટ</Text></Pressable>
           )}
        </View>
      </View>
    </View>
  );
}

// 4. RESTORED 100% Full BookingScreen Logic
function BookingScreen({ onBack, session, profile, initialData, allowedPlaces }: { onBack: () => void, session: Session, profile: Profile, initialData?: any, allowedPlaces?: any[] }) {
  const [places, setPlaces] = useState<any[]>(allowedPlaces || []); 
  const [menuItems, setMenuItems] = useState<any[]>([]); 
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialData?.name || ''); 
  const [mobile, setMobile] = useState(initialData?.mobile || '');
  
  let defaultPlace = initialData?.place_id || null;
  if (!defaultPlace && allowedPlaces && allowedPlaces.length === 1) defaultPlace = allowedPlaces[0].id;
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(defaultPlace);
  
  const [meals, setMeals] = useState<any[]>(initialData?.meals || []); 
  const [showMealBuilder, setShowMealBuilder] = useState(false); 
  const [editingMealIndex, setEditingMealIndex] = useState<number | null>(null);
  
  const [thakorjiSeva, setThakorjiSeva] = useState(initialData?.thakorji_seva?.toString() || '0'); 
  const [receiptNo, setReceiptNo] = useState(initialData?.receipt_no || '');
  const [paymentStatus, setPaymentStatus] = useState(initialData?.payment_status || 'પૂર્ણ સેવા'); 

  useEffect(() => {
    async function fetchData() {
      if (!supabase) return;
      if (!allowedPlaces || allowedPlaces.length === 0) { const { data } = await supabase.from('places').select('*').eq('is_active', true); if (data) setPlaces(data.map(p => ({ label: p.name, value: p.id }))); } 
      else setPlaces(allowedPlaces.map(p => ({ label: p.name || p.label, value: p.id || p.value })));
      const { data: mData } = await supabase.from('menu_items').select('*').eq('is_active', true);
      if (mData) setMenuItems(mData);
    }
    fetchData();
  }, []);

  let mealsTotal = 0; meals.forEach(m => mealsTotal += (m.ratePerPlate * (m.guestsCount || 0)));
  const grandTotal = mealsTotal + (parseInt(thakorjiSeva) || 0); 
  const diffTotal = grandTotal - (initialData ? (initialData.grand_total || 0) : 0);

  async function handleSaveBooking() {
    if (!name || !mobile || meals.length === 0) return showMsg('અધૂરી માહિતી', 'નામ, નંબર અને ઓછામાં ઓછો 1 જમણવાર ઉમેરવો જરૂરી છે.');
    if (!selectedPlaceId) return showMsg('ભૂલ', 'બુકિંગ માટે સ્થળ પસંદ કરવું ફરજિયાત છે.');
    if (!supabase) return; setSaving(true);
    try {
      const payload = { name, mobile, place_id: selectedPlaceId, meals, thakorji_seva: (parseInt(thakorjiSeva) || 0), receipt_no: receiptNo, payment_status: paymentStatus, grand_total: grandTotal, user_id: session.user.id };
      const res = initialData?.id ? await supabase.from('bookings').update(payload).eq('id', initialData.id) : await supabase.from('bookings').insert([payload]);
      if (res.error) throw res.error;
      showMsg('સફળતા 🎉', `બુકિંગ સેવ થઈ ગયું!`); onBack();
    } catch (err: any) { showMsg('Error', err.message); } finally { setSaving(false); }
  }

  return (
    <View style={s.p18}>
      <Pressable onPress={onBack} style={s.backButton}><Text style={s.backText}>‹ પાછા</Text></Pressable>
      <Text style={s.h1}>{initialData ? 'બુકિંગ એડિટ કરો' : 'નવી રસોઈ સેવા બુકિંગ'}</Text>
      
      <View style={s.formCard}>
        <Text style={s.sectionTitle}>1. યજમાનની વિગતો</Text>
        <TextInput placeholder="નામ" style={s.input} value={name} onChangeText={setName} />
        <TextInput placeholder="મોબાઇલ નંબર (૧૦ આંકડા)" style={s.input} keyboardType="phone-pad" maxLength={10} value={mobile} onChangeText={setMobile} />
        {places.length === 1 ? <View style={{marginBottom: 14}}><Text style={s.label}>બુકિંગ સ્થળ</Text><TextInput style={[s.input, {backgroundColor: '#f1f5f9'}]} value={places[0].label} editable={false} /></View> : <Dropdown label="સ્થળ પસંદ કરો" options={places} selectedValue={selectedPlaceId} onSelect={setSelectedPlaceId} />}
        
        <Text style={[s.sectionTitle, {marginTop: 20}]}>2. જમણવાર અને મેનૂ</Text>
        {meals.map((meal, index) => (
          <View key={index} style={s.mealBox}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}><Text style={{fontWeight:'bold', color:'#1e3a8a'}}>🗓️ {meal.date} • ⏰ {meal.time}</Text><Text>({meal.guestsCount} લોકો)</Text></View>
            <Text style={{fontWeight:'bold', marginTop: 5}}>{meal.mainType}</Text>
            <View style={{flexDirection: 'row', gap: 10, marginTop: 12}}>
              <Pressable onPress={() => { setEditingMealIndex(index); setShowMealBuilder(true); }} style={[s.editBtn, {flex: 1, alignItems: 'center'}]}><Text>✏️ એડિટ</Text></Pressable>
              <Pressable onPress={() => setMeals(meals.filter((_, i) => i !== index))} style={[s.editBtn, {backgroundColor: '#fef2f2', borderColor: '#fca5a5'}]}><Text style={{color: '#dc2626'}}>🗑️</Text></Pressable>
            </View>
          </View>
        ))}
        <Pressable onPress={() => { setEditingMealIndex(null); setShowMealBuilder(true); }} style={[s.primary, {backgroundColor:'#ffffff', borderWidth: 2, borderColor:'#047857', borderStyle:'dashed'}]}><Text style={{color:'#047857', fontWeight:'bold'}}>＋ નવો જમણવાર ઉમેરો</Text></Pressable>

        <Text style={[s.sectionTitle, {marginTop: 20}]}>3. અન્ય ફંડ અને સેવા (પેમેન્ટ)</Text>
        <Dropdown label="ઠાકોરજી સેવા (₹)" options={[{label:'₹ 0', value:'0'}, {label:'₹ 5100', value:'5100'}, {label:'₹ 11000', value:'11000'}]} selectedValue={thakorjiSeva} onSelect={setThakorjiSeva} />
        <TextInput placeholder="પહોંચ નંબર" style={s.input} value={receiptNo} onChangeText={setReceiptNo} />
        <Dropdown label="સેવા સ્ટેટસ (Payment Status)" options={[{label:'પૂર્ણ સેવા (Full)', value:'પૂર્ણ સેવા'}, {label:'બાકી સેવા (Partial)', value:'બાકી સેવા'}]} selectedValue={paymentStatus} onSelect={setPaymentStatus} />
        
        <View style={s.totalBox}>
          <Text style={s.grandTotal}>ફાઇનલ કુલ સેવા: ₹ {grandTotal.toLocaleString()}</Text>
          {initialData && diffTotal !== 0 && <Text style={{fontSize: 17, fontWeight: '900', color: diffTotal > 0 ? '#dc2626' : '#047857', marginTop: 8}}>{diffTotal > 0 ? `વધારાની સેવા જમા: ₹${diffTotal}` : `પરત સેવા રકમ: ₹${Math.abs(diffTotal)}`}</Text>}
        </View>
        <Pressable disabled={saving} onPress={handleSaveBooking} style={({pressed})=> [s.saveBtn, pressed && {opacity:0.8}]}><Text style={s.saveBtnText}>{saving ? 'Saving...' : 'બુકિંગ ફાઇનલ સેવ કરો'}</Text></Pressable>
      </View>
      <MealBuilderModal visible={showMealBuilder} onClose={() => { setShowMealBuilder(false); setEditingMealIndex(null); }} menuItems={menuItems} onSave={(d:any)=> { if (editingMealIndex !== null) { const up = [...meals]; up[editingMealIndex] = d; setMeals(up); } else setMeals([...meals, d]); setShowMealBuilder(false); }} initialData={editingMealIndex !== null ? meals[editingMealIndex] : null} />
    </View>
  );
}

// RESTORED 100%: MealBuilderModal and Date/Time Pickers
function MealBuilderModal({ visible, onClose, onSave, menuItems, initialData }: any) {
  const [date, setDate] = useState(''); const [time, setTime] = useState(''); const [guestsCount, setGuestsCount] = useState(''); 
  const [mainType, setMainType] = useState('લંચ'); const [selectedItems, setSelectedItems] = useState<any>({});
  const [calculatedTotal, setCalculatedTotal] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      if (initialData) { setDate(initialData.date); setTime(initialData.time); setGuestsCount(initialData.guestsCount.toString()); setMainType(initialData.mainType); setCalculatedTotal(initialData.ratePerPlate); const m: any = {}; initialData.items.forEach((i:any) => m[i.id || i] = true); setSelectedItems(m); } 
      else { setDate(''); setTime(''); setGuestsCount(''); setMainType('લંચ'); setSelectedItems({}); setCalculatedTotal(null); }
    }
  }, [visible, initialData]);

  if (!visible) return null;
  const filteredMenu = menuItems.filter((m:any) => m.is_active && m.main_type === mainType);
  
  // અહી કેટેગરીને (મિષ્ટાન્ન વગેરે) એડમિન પેનલના ક્રમ મુજબ પરફેક્ટ સોર્ટ કરવાનું લોજિક છે:
  const availableSubs = Array.from(new Set(filteredMenu.map((m:any)=>m.sub_category).filter(Boolean)));
  availableSubs.sort((a: any, b: any) => {
    const valA = filteredMenu.find((m:any) => m.sub_category === a)?.sub_sort ?? 99;
    const valB = filteredMenu.find((m:any) => m.sub_category === b)?.sub_sort ?? 99;
    return valA - valB;
  });

  function handleSave() {
    if (!date || !time || !guestsCount) return showMsg('Error', 'તારીખ, સમય અને લોકોની સંખ્યા લખવી જરૂરી છે');
    if (calculatedTotal === null) return showMsg('Error', 'પહેલા મેનૂની સેવા ગણો');
    onSave({ date, time, guestsCount: parseInt(guestsCount) || 0, mainType, items: menuItems.filter((m:any) => selectedItems[m.id]), ratePerPlate: calculatedTotal });
  }

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={{flex:1, backgroundColor:'#f8fafc'}}>
        <View style={[s.header, {paddingTop: Platform.OS === 'web' ? 20 : 0}]}><Text style={s.h1}>{initialData ? 'જમણવાર એડિટ કરો' : 'નવો જમણવાર ઉમેરો'}</Text><Pressable onPress={onClose}><Text style={{fontSize:24, color: '#64748b'}}>✕</Text></Pressable></View>
        <ScrollView contentContainerStyle={[s.webContainer, s.p18]}>
          <View style={s.formCard}>
            <DatePickerModal label="તારીખ પસંદ કરો" selectedDate={date} onSelect={setDate} />
            <AlarmTimePicker label="જમવાનો સમય" selectedTime={time} onSelect={setTime} />
            <TextInput placeholder="લોકોની સંખ્યા દા.ત. 150" style={s.input} keyboardType="numeric" value={guestsCount} onChangeText={setGuestsCount} />
            <Dropdown label="જમવાનો પ્રકાર" options={Array.from(new Set(menuItems.sort((a:any,b:any)=>(a.main_sort||99)-(b.main_sort||99)).map((m:any)=>m.main_type))).map(t => ({label: t, value: t}))} selectedValue={mainType} onSelect={setMainType} />
            <Text style={[s.sectionTitle, {marginTop: 15}]}>મેનૂ પસંદગી</Text>
            {availableSubs.map((sub: any) => (
               <View key={sub} style={{marginBottom: 10}}>
                 <Text style={{fontSize: 16, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 8}}>{sub}</Text>
                 <View style={s.chipContainer}>{filteredMenu.filter((m:any) => m.sub_category === sub).map((item:any) => (
                    <Pressable key={item.id} style={[s.chip, selectedItems[item.id] && s.chipSelected]} onPress={() => setSelectedItems({ ...selectedItems, [item.id]: !selectedItems[item.id] })}>
                      <Text style={[s.chipText, selectedItems[item.id] && s.chipTextSelected]}>{item.name}</Text>
                    </Pressable>
                 ))}</View>
               </View>
            ))}
            <Pressable onPress={()=> { let total = 0; menuItems.forEach((item:any) => { if (selectedItems[item.id]) total += item.price; }); setCalculatedTotal(total); }} style={[s.primary, {backgroundColor:'#0284c7', marginTop: 20}]}><Text style={s.primaryText}>સેવા રાશી ગણો</Text></Pressable>
            {calculatedTotal !== null && <View style={s.autoRateBox}><Text style={s.autoRateLabel}>૧ ડિશની ફિક્સ સેવા:</Text><Text style={s.autoRateValue}>₹ {calculatedTotal}</Text></View>}
            <Pressable onPress={handleSave} style={[s.saveBtn, {marginTop: 20}]}><Text style={s.saveBtnText}>{initialData ? 'ફેરફાર સેવ કરો' : 'આ જમણવાર સેવ કરો'}</Text></Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function DatePickerModal({ label, selectedDate, onSelect, placeholder }: any) {
  const [visible, setVisible] = useState(false); const [day, setDay] = useState(new Date().getDate()); const [month, setMonth] = useState(new Date().getMonth() + 1); const [year, setYear] = useState(new Date().getFullYear());
  useEffect(() => { if (visible && selectedDate) { const [d, m, y] = selectedDate.split('-'); if (d && m && y) { setDay(parseInt(d)); setMonth(parseInt(m)); setYear(parseInt(y)); } } }, [visible]);
  function handleSave() { onSelect(`${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${year}`); setVisible(false); }
  return (
    <View style={{ marginBottom: 14 }}><Text style={s.label}>{label}</Text><Pressable onPress={() => setVisible(true)} style={[s.input, { marginBottom: 0 }]}><Text style={{ color: selectedDate ? '#1e293b' : '#9ca3af', fontSize: 16 }}>{selectedDate || placeholder || 'તારીખ પસંદ કરો'}</Text></Pressable>
      <Modal visible={visible} transparent animationType="fade"><View style={s.modalBg}><View style={[s.modalContent, {alignItems: 'center'}]}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 15, marginVertical: 20}}>
          <View style={{alignItems: 'center'}}><Pressable onPress={()=>setDay(d=>d>=31?1:d+1)} style={s.arrowBtn}><Text style={s.arrowText}>▲</Text></Pressable><Text style={s.timeText}>{day.toString().padStart(2, '0')}</Text><Pressable onPress={()=>setDay(d=>d<=1?31:d-1)} style={s.arrowBtn}><Text style={s.arrowText}>▼</Text></Pressable></View>
          <Text style={s.timeText}>/</Text>
          <View style={{alignItems: 'center'}}><Pressable onPress={()=>setMonth(m=>m>=12?1:m+1)} style={s.arrowBtn}><Text style={s.arrowText}>▲</Text></Pressable><Text style={s.timeText}>{month.toString().padStart(2, '0')}</Text><Pressable onPress={()=>setMonth(m=>m<=1?12:m-1)} style={s.arrowBtn}><Text style={s.arrowText}>▼</Text></Pressable></View>
          <Text style={s.timeText}>/</Text>
          <View style={{alignItems: 'center'}}><Pressable onPress={()=>setYear(y=>y+1)} style={s.arrowBtn}><Text style={s.arrowText}>▲</Text></Pressable><Text style={[s.timeText, {width: 80}]}>{year}</Text><Pressable onPress={()=>setYear(y=>y-1)} style={s.arrowBtn}><Text style={s.arrowText}>▼</Text></Pressable></View>
        </View>
        <Pressable onPress={handleSave} style={[s.primary, {width: '100%'}]}><Text style={s.primaryText}>તારીખ સેવ કરો</Text></Pressable>
      </View></View></Modal></View>
  );
}

function AlarmTimePicker({ label, selectedTime, onSelect, placeholder }: any) {
  const [visible, setVisible] = useState(false); const [hour, setHour] = useState(10); const [minute, setMinute] = useState(30); const [ampm, setAmpm] = useState('AM');
  function handleSave() { onSelect(`${hour}:${minute.toString().padStart(2, '0')} ${ampm}`); setVisible(false); }
  return (
    <View style={{ marginBottom: 14 }}><Text style={s.label}>{label}</Text><Pressable onPress={() => setVisible(true)} style={[s.input, { marginBottom: 0 }]}><Text style={{ color: selectedTime ? '#1e293b' : '#9ca3af', fontSize: 16 }}>{selectedTime || placeholder || 'સમય પસંદ કરો'}</Text></Pressable>
      <Modal visible={visible} transparent animationType="fade"><View style={s.modalBg}><View style={[s.modalContent, {alignItems: 'center'}]}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 20, marginVertical: 20}}>
          <View style={{alignItems: 'center'}}><Pressable onPress={()=>setHour(h=>h===12?1:h+1)} style={s.arrowBtn}><Text style={s.arrowText}>▲</Text></Pressable><Text style={s.timeText}>{hour}</Text><Pressable onPress={()=>setHour(h=>h===1?12:h-1)} style={s.arrowBtn}><Text style={s.arrowText}>▼</Text></Pressable></View><Text style={s.timeText}>:</Text>
          <View style={{alignItems: 'center'}}><Pressable onPress={()=>setMinute(m=>m>=55?0:m+5)} style={s.arrowBtn}><Text style={s.arrowText}>▲</Text></Pressable><Text style={s.timeText}>{minute.toString().padStart(2, '0')}</Text><Pressable onPress={()=>setMinute(m=>m<=0?55:m-5)} style={s.arrowBtn}><Text style={s.arrowText}>▼</Text></Pressable></View>
          <Pressable onPress={()=>setAmpm(a=>a==='AM'?'PM':'AM')} style={s.ampmBtn}><Text style={s.ampmText}>{ampm}</Text></Pressable>
        </View>
        <Pressable onPress={handleSave} style={[s.primary, {width: '100%'}]}><Text style={s.primaryText}>સમય સેવ કરો</Text></Pressable>
      </View></View></Modal></View>
  );
}

function Dropdown({ label, options, selectedValue, onSelect, placeholder, onAddNew }: any) {
  const [visible, setVisible] = useState(false); const selected = options.find((o: any) => o.value === selectedValue);
  return (
    <View style={{ marginBottom: 14 }}>{label && <Text style={s.label}>{label}</Text>}<Pressable onPress={() => setVisible(true)} style={s.input}><Text style={{ color: selected ? '#1e293b' : '#9ca3af', fontSize: 16 }}>{selected ? selected.label : placeholder || 'પસંદ કરો'}</Text></Pressable>
      <Modal visible={visible} transparent animationType="slide"><View style={s.modalBg}><View style={s.modalContent}><ScrollView>{options.map((o: any) => (<Pressable key={o.value} style={s.modalItem} onPress={() => { onSelect(o.value); setVisible(false); }}><Text style={[s.modalItemText, selectedValue === o.value ? { color: '#047857', fontWeight: 'bold' } : null]}>{o.label}</Text></Pressable>))}{onAddNew && ( <Pressable style={s.modalItem} onPress={() => { setVisible(false); onAddNew(); }}><Text style={{color: '#047857', fontWeight: '900'}}>＋ નવો પ્રકાર ઉમેરો</Text></Pressable> )}</ScrollView><Pressable onPress={() => setVisible(false)} style={s.closeButton}><Text style={s.closeText}>બંધ કરો</Text></Pressable></View></View></Modal></View>
  );
}
function Card({ title, icon, value }: any) { return <View style={s.card}><Text style={s.icon}>{icon}</Text><Text style={s.muted}>{title}</Text><Text style={s.value}>{value}</Text></View>; }
function LoadingScreen() { return <SafeAreaView style={s.center}><ActivityIndicator size="large" color="#047857" /><Text style={{marginTop:10, color: '#64748b'}}>Loading...</Text></SafeAreaView>; }
function SetupScreen() { return <SafeAreaView style={s.center}><Text style={{color: '#dc2626'}}>Supabase config missing.</Text></SafeAreaView>; }

// ================= STYLES =================
const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#f8fafc'}, webContainer: { maxWidth: 1200, width: '100%', alignSelf: 'center' }, p18: { padding: 18 }, 
  loginSafe:{flex:1,backgroundColor:'#f8fafc',justifyContent:'center',padding:20}, center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#f8fafc'}, 
  loginCard:{backgroundColor:'#ffffff',borderRadius:20,padding:30, borderWidth: 1, borderColor: '#e2e8f0'}, loginTitle:{fontSize:24,fontWeight:'900',textAlign:'center',color:'#047857'}, loginSub:{textAlign:'center',color:'#64748b',marginBottom:24,marginTop:6,fontSize:14, fontWeight: '600'}, 
  header:{paddingHorizontal:20,paddingVertical:16,backgroundColor:'#ffffff',flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#e2e8f0'}, 
  headerText:{flex:1,marginRight:10}, appTitle:{fontSize:18,fontWeight:'900',color:'#1e293b'}, role:{fontSize:13,color:'#64748b',marginTop:2, fontWeight: '600'}, logout:{paddingVertical:8,paddingHorizontal:12,borderRadius:8,backgroundColor:'#fef2f2', borderWidth: 1, borderColor: '#fca5a5'}, 
  h1:{fontSize:26,fontWeight:'900',marginBottom:10, color:'#1e293b'}, muted:{color:'#64748b',lineHeight:20, fontSize: 14}, 
  grid:{flexDirection:'row',flexWrap:'wrap',gap:12,marginVertical:15}, card:{backgroundColor:'#ffffff',borderRadius:16,padding:18,width:'48%',minHeight:110,borderWidth:1,borderColor:'#e2e8f0'}, 
  icon:{fontSize:28}, value:{fontSize:26,fontWeight:'900',marginTop:6, color: '#1e293b'}, 
  todayGuestsCard: { borderRadius: 16, padding: 18, borderWidth: 1.5, marginVertical: 10 }, mealPill: { backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#a7f3d0', alignSelf: 'flex-start' },
  input:{backgroundColor:'#ffffff',borderWidth:1,borderColor:'#cbd5e1',borderRadius:10,padding:14,marginBottom:14,fontSize:16, color: '#1e293b'}, label:{fontWeight:'700',marginBottom:6, marginTop:4, color: '#334155', fontSize: 14}, 
  primary:{backgroundColor:'#047857',padding:16,borderRadius:12,alignItems:'center',marginVertical:6}, primaryText:{color:'#fff',fontSize:16,fontWeight:'800'}, 
backButton: { alignSelf: 'flex-start', paddingVertical: 12, paddingHorizontal: 20, marginBottom: 18, backgroundColor: '#f1f5f9', borderRadius: 30, borderWidth: 1.5, borderColor: '#cbd5e1' }, backText: { fontSize: 16, fontWeight: '900', color: '#0f172a' },  formCard:{backgroundColor:'#ffffff',borderRadius:16,padding:20,marginTop:12,borderWidth:1,borderColor:'#e2e8f0'}, sectionTitle:{fontSize:18,fontWeight:'900',marginBottom:14, color: '#1e293b'}, 
  menuBtn: { backgroundColor: '#ffffff', padding: 18, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }, menuBtnText: { color: '#1e293b', fontSize: 16, fontWeight: 'bold' }, 
  listCard: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, backgroundColor:'#ffffff', marginBottom:10, borderRadius:12, borderWidth:1, borderColor:'#e2e8f0' }, 
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }, editBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff' }, editBtnText: { fontWeight: 'bold', color: '#475569', fontSize: 13 }, 
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }, modalContent: { backgroundColor: '#ffffff', borderRadius: 20, padding: 22, margin: 20, maxHeight: '80%', borderWidth: 1, borderColor: '#e2e8f0' }, 
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 15, color: '#1e293b' }, modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }, modalItemText: { fontSize: 16, color: '#334155' }, closeButton: { marginTop: 12, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 10, alignItems: 'center' }, closeText: { fontWeight: 'bold', color: '#475569' }, 
  refreshBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#f1f5f9', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' }, refreshBtnText: { fontSize: 14, color: '#1e3a8a', fontWeight: 'bold' },
  prodTabBar: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 15 }, prodTabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 }, prodTabBtnActive: { backgroundColor: '#ffffff' }, prodTabBtnText: { fontWeight: 'bold', color: '#64748b' }, prodTabBtnTextActive: { color: '#047857', fontWeight: '900' },
  saveBtn: { backgroundColor: '#d97706', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 }, saveBtnText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  mainTypeHeader: { fontSize: 20, fontWeight: '900', color: '#047857', borderBottomWidth: 2, borderBottomColor: '#047857', paddingBottom: 6, marginBottom: 12, marginTop: 10 }, collapsibleHeader: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }, collapsibleHeaderText: { fontSize: 16, fontWeight: 'bold', color: '#1e3a8a' }, collapsibleHeaderIcon: { fontSize: 14, color: '#1e3a8a', fontWeight: 'bold' }, chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 4, marginBottom: 15 }, chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 25, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff' }, chipSelected: { backgroundColor: '#047857', borderColor: '#047857' }, chipText: { fontSize: 14, color: '#475569', fontWeight: '600' }, chipTextSelected: { color: '#ffffff' },
  bookingCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' }, mealBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: '#e2e8f0' }, statusBadgeText: { backgroundColor: '#f0fdf4', color: '#047857', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontWeight: 'bold', fontSize: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#bbf7d0' },
  totalBox: { backgroundColor: '#fefce8', padding: 16, borderRadius: 12, marginTop: 15, alignItems: 'flex-end', borderWidth: 1, borderColor: '#fde047' }, grandTotal: { fontSize: 22, fontWeight: '900', color: '#854d0e' },
  arrowBtn: { padding: 10, backgroundColor: '#f1f5f9', borderRadius: 10 }, arrowText: { fontSize: 20, color: '#475569' }, timeText: { fontSize: 28, fontWeight: 'bold', marginVertical: 10, width: 50, textAlign: 'center', color: '#1e293b' }, ampmBtn: { backgroundColor: '#047857', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 10, marginLeft: 10 }, ampmText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  autoRateBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f0fdf4', borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0', marginTop: 15 }, autoRateLabel: { fontSize: 16, fontWeight: 'bold', color: '#166534' }, autoRateValue: { fontSize: 20, fontWeight: '900', color: '#047857' },
  // Smart Swap Styles
  dragItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  dragHandle: { fontSize: 20, color: '#94a3b8', marginRight: 15, fontWeight: 'bold' },
  dragging: { backgroundColor: '#dbeafe', borderWidth: 1, borderColor: '#93c5fd', borderRadius: 8 }
});