import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, Platform, Linking, Image, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';

type Role = 'admin' | 'counter' | 'production' | 'dispatch';
type Profile = { id: string; full_name: string | null; mobile: string | null; role: Role; is_active: boolean; duty_places?: string[]; photo_url?: string; login_email?: string; login_pass?: string };

const roleLabel: Record<Role, string> = { admin: 'Super Admin', counter: 'Cash Counter', production: 'Production (રસોડું)', dispatch: 'Dispatch' };

const BASE_MAIN_TYPES = ['નાસ્તો', 'મોર્નિંગ સ્નેક', 'લંચ', 'હાઈ ટી', 'ડિનર', 'નાઈટ સ્નેક'];
const BASE_SUB_TYPES = ['મિષ્ટાન્ન', 'ફરસાણ', 'રોટલી', 'શાક', 'પનીર પંજાબી', 'વેજ. પંજાબી', 'કઠોળ', 'ભાત', 'દાળ', 'સલાડ', 'છાશ', 'મુખવાસ', 'લિક્વિડ', 'વિશેષ'];

function getTodayStr() {
  const today = new Date();
  return `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
}

function getSortedItems(items: any[], dynamicSubs: string[]) {
  return [...(items || [])].sort((a, b) => {
    let indexA = dynamicSubs.indexOf(a.sub_category || 'સામાન્ય');
    let indexB = dynamicSubs.indexOf(b.sub_category || 'સામાન્ય');
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    return indexA - indexB;
  });
}

function parseTimeForSort(timeStr: string) {
  if (!timeStr) return 0;
  const [time, modifier] = timeStr.split(' ');
  if (!time || !modifier) return 0;
  let [hours, minutes] = time.split(':');
  let h = parseInt(hours, 10);
  if (h === 12) h = 0;
  if (modifier === 'PM') h += 12;
  return (h * 60) + parseInt(minutes, 10);
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setProfile(null);
    });
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
      if (error || !data || !data.is_active) {
        Alert.alert('Error', 'Account inactive or missing.');
        await supabase.auth.signOut();
        return;
      }
      
      // Parse duty_places array (Handles migration from single string to JSON array)
      let parsedPlaces: string[] = [];
      if (data.duty_places) {
          if (Array.isArray(data.duty_places)) parsedPlaces = data.duty_places;
          else if (typeof data.duty_places === 'string') {
              try { parsedPlaces = JSON.parse(data.duty_places); } 
              catch(e) { parsedPlaces = [data.duty_places]; }
          }
      } else if ((data as any).duty_place) { // Fallback for old single duty_place column
          parsedPlaces = [(data as any).duty_place];
      }
      
      setProfile({...data, duty_places: parsedPlaces} as Profile);
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<any>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); setIsInstallable(true); };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  async function handleInstallApp() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsInstallable(false);
      setDeferredPrompt(null);
    }
  }

  async function signIn() {
    if (!email.trim() || !password) return Alert.alert('Error', 'યુઝર ID અને પાસવર્ડ નાખો');
    if (!supabase) return;
    setSubmitting(true);
    const rawInput = email.trim().toLowerCase();
    const loginEmail = rawInput.includes('@') ? rawInput : `${rawInput}@baps.local`;
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setSubmitting(false);
    if (error) Alert.alert('Login failed', 'યુઝર ID અથવા પાસવર્ડ ખોટો છે.');
  }

  return (
    <SafeAreaView style={s.loginSafe}>
      <View style={s.webContainer}>
        <View style={s.loginCard}>
          <Image source={require('./assets/icon.png')} style={{ width: 130, height: 130, alignSelf: 'center', marginBottom: 15, resizeMode: 'contain' }} />
          <Text style={s.loginTitle}>BAPS RAJKOT KITCHEN</Text>
          <Text style={s.loginSub}>Rasoi Seva Management System</Text>
          
          <TextInput value={email} onChangeText={setEmail} placeholder="યુઝર ID (દા.ત. Rasodu1)" placeholderTextColor="#9ca3af" style={s.input} autoCapitalize="none" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
          <TextInput ref={passwordRef} value={password} onChangeText={setPassword} placeholder="પાસવર્ડ" placeholderTextColor="#9ca3af" style={s.input} secureTextEntry returnKeyType="go" onSubmitEditing={signIn} />
          
          <Pressable disabled={submitting} onPress={signIn} style={s.primary}>
            <Text style={s.primaryText}>{submitting ? 'લૉગ ઇન થઈ રહ્યું છે…' : 'Login'}</Text>
          </Pressable>

          {isInstallable && (
            <Pressable onPress={handleInstallApp} style={[s.primary, {backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#047857', marginTop: 12}]}>
              <Text style={{color: '#047857', fontSize: 16, fontWeight: '800'}}>⬇️ Install App (એપ ઇન્સ્ટોલ કરો)</Text>
            </Pressable>
          )}
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
        <View style={s.headerText}>
          <Text style={s.appTitle}>BAPS Rajkot Kitchen</Text>
          <Text style={s.role}>{roleLabel[profile.role]} • {profile.full_name}</Text>
        </View>
        <Pressable onPress={logout} style={s.logout}><Text style={{fontWeight:'bold', color:'#dc2626'}}>લોગઆઉટ</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={s.webContainer}>
        {profile.role === 'admin' ? <AdminHome session={session} profile={profile} /> : null}
        {profile.role === 'counter' ? <CounterHome session={session} profile={profile} /> : null}
        {profile.role === 'production' ? <ProductionHome /> : null}
        {profile.role === 'dispatch' ? <DispatchHome /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ================= ADMIN MODULE =================
function AdminHome({ session, profile }: { session: Session, profile: Profile }) { 
  const [activeTab, setActiveTab] = useState<'home'|'menu'|'places'|'users'|'bookings'|'today'|'settings'>('home');
  const [stats, setStats] = useState({ count: 0, revenue: 0 });
  const [todayGuestsTotal, setTodayGuestsTotal] = useState(0);
  const [todayGuestsByMeal, setTodayGuestsByMeal] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showRevenue, setShowRevenue] = useState(false);

  useEffect(() => { if(activeTab === 'home') fetchDashboard(); }, [activeTab]);

  async function fetchDashboard() {
    if (!supabase) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.from('bookings').select('*');
      if (error) throw error;
      if (data) {
        const todayStr = getTodayStr();
        let tRevenue = 0; let tGuests = 0; let mealMap: Record<string, number> = {};

        data.forEach(b => {
          tRevenue += (b.grand_total || 0);
          if (b.meals) {
            b.meals.forEach((m: any) => {
              if (m.date === todayStr) {
                const g = m.guestsCount || 0;
                tGuests += g;
                mealMap[m.mainType] = (mealMap[m.mainType] || 0) + g;
              }
            });
          }
        });

        setStats({ count: data.length, revenue: tRevenue });
        setTodayGuestsTotal(tGuests); setTodayGuestsByMeal(mealMap);
      }
    } catch (err: any) { Alert.alert('Database Fetch Error', err.message); } finally { setRefreshing(false); }
  }

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
          <Pressable onPress={() => setActiveTab('menu')} style={s.menuBtn}><Text style={s.menuBtnText}>🍽️ મેનૂ સેટિંગ્સ</Text></Pressable>
          <Pressable onPress={() => setActiveTab('places')} style={s.menuBtn}><Text style={s.menuBtnText}>📍 સ્થળ સેટિંગ્સ</Text></Pressable>
          <Pressable onPress={() => setActiveTab('users')} style={[s.menuBtn, {backgroundColor: '#4f46e5'}]}><Text style={s.menuBtnText}>👤 યુઝર મેનેજમેન્ટ</Text></Pressable>
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
             <Pressable onPress={() => setShowRevenue(!showRevenue)} style={{padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20}}>
                <Text style={{fontSize: 16}}>{showRevenue ? '🙈' : '👁️'}</Text>
             </Pressable>
          </View>
          <Text style={s.muted}>કુલ રકમ (₹)</Text>
          <Text style={s.value}>{showRevenue ? `₹ ${stats.revenue.toLocaleString()}` : '₹ *******'}</Text>
        </View>
      </View>

      <View style={s.todayGuestsCard}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}><Text style={{fontSize: 24}}>👥</Text><Text style={{fontSize: 18, fontWeight: '900', color: '#065f46'}}>આજના કુલ યજમાનો</Text></View>
          <Text style={{color: '#047857', fontWeight: 'bold', fontSize: 13}}>🗓️ {getTodayStr()}</Text>
        </View>

        {Object.keys(todayGuestsByMeal).length === 0 ? (
          <Text style={{color: '#64748b', fontSize: 14, marginTop: 4}}>આજે કોઈ જમણવાર નોંધાયેલ નથી.</Text>
        ) : (
          <View style={{marginTop: 6}}>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10}}>
              {Object.keys(todayGuestsByMeal).map(mType => (
                <View key={mType} style={s.mealPill}>
                  <Text style={{fontSize: 13, color: '#334155'}}><Text style={{fontWeight: 'bold', color: '#047857'}}>{mType}:</Text> {todayGuestsByMeal[mType]} લોકો</Text>
                </View>
              ))}
            </View>
            <View style={{borderTopWidth: 1, borderTopColor: '#a7f3d0', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
              <Text style={{fontSize: 15, fontWeight: '800', color: '#065f46'}}>આજના કુલ મહેમાનો:</Text>
              <Text style={{fontSize: 24, fontWeight: '900', color: '#047857'}}>{todayGuestsTotal.toLocaleString()} લોકો</Text>
            </View>
          </View>
        )}
      </View>

      <Pressable onPress={() => setActiveTab('today')} style={[s.primary, {backgroundColor: '#047857', paddingVertical: 18, marginBottom: 12}]}>
         <Text style={{color:'#fff', fontWeight:'900', textAlign: 'center', fontSize: 17}}>📅 આજનો સંપૂર્ણ રિપોર્ટ (Today's Report)</Text>
      </Pressable>

      <Pressable onPress={() => setActiveTab('bookings')} style={[s.primary, {backgroundColor: '#ffffff', borderWidth: 2, borderColor:'#047857', marginBottom: 20, paddingVertical: 18}]}>
         <Text style={{color:'#047857', fontWeight:'900', textAlign: 'center', fontSize: 17}}>📋 બધા બુકિંગ્સ (All Bookings)</Text>
      </Pressable>
    </View>
  ); 
}

// ================= TODAY'S REPORT (ADMIN) =================
function TodayReportScreen({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [loading, setLoading] = useState(true);
  const [totalGuests, setTotalGuests] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [fullPayCount, setFullPayCount] = useState(0);
  const [partialPayCount, setPartialPayCount] = useState(0);
  const [mealBreakdown, setMealBreakdown] = useState<Record<string, number>>({});
  const [menuAggregates, setMenuAggregates] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const [dispatchSchedule, setDispatchSchedule] = useState<any[]>([]);
  const [dynamicSubs, setDynamicSubs] = useState<string[]>(BASE_SUB_TYPES);

  const todayStr = getTodayStr();

  useEffect(() => { fetchTodayData(); }, []);

  async function fetchTodayData() {
    setLoading(true);
    if (!supabase) return;
    try {
      const { data: menuData } = await supabase.from('menu_items').select('*');
      if (menuData) setDynamicSubs(Array.from(new Set([...BASE_SUB_TYPES, ...menuData.map(m=>m.sub_category).filter(Boolean)])));

      const { data, error } = await supabase.from('bookings').select('*');
      const { data: pData } = await supabase.from('places').select('*');
      if (error) throw error;

      if (data) {
        let tGuests = 0, tRevenue = 0, fPay = 0, pPay = 0;
        let agg: Record<string, Record<string, Record<string, number>>> = {};
        let mBreakdown: Record<string, number> = {};
        let tSchedule: any[] = [];

        data.forEach(b => {
          let hasTodayMeal = false;
          let placeName = pData?.find((p:any) => p.id === b.place_id)?.name || 'સ્થળ નથી';
          if (b.meals) {
            b.meals.forEach((m: any) => {
              if (m.date === todayStr) {
                hasTodayMeal = true;
                const gCount = m.guestsCount || 0;
                tGuests += gCount;
                tRevenue += (m.ratePerPlate * gCount);
                if (!mBreakdown[m.mainType]) mBreakdown[m.mainType] = 0;
                mBreakdown[m.mainType] += gCount;

                if (!agg[m.mainType]) agg[m.mainType] = {};
                m.items?.forEach((i: any) => {
                  const sub = i.sub_category || 'અન્ય';
                  if (!agg[m.mainType][sub]) agg[m.mainType][sub] = {};
                  if (!agg[m.mainType][sub][i.name]) agg[m.mainType][sub][i.name] = 0;
                  agg[m.mainType][sub][i.name] += gCount; 
                });

                tSchedule.push({
                  bookingId: b.id, hostName: `${b.name} ${b.surname}`, mobile: b.mobile,
                  time: m.time, timeValue: parseTimeForSort(m.time), placeName: placeName,
                  mainType: m.mainType, guestsCount: gCount, items: getSortedItems(m.items || [], dynamicSubs).map((i:any)=>i.name), note: m.note
                });
              }
            });
          }
          if (hasTodayMeal) {
            if (b.payment_status === 'Full') fPay++;
            if (b.payment_status === 'Partial') pPay++;
          }
        });
        tSchedule.sort((a, b) => a.timeValue - b.timeValue);
        setTotalGuests(tGuests); setTotalRevenue(tRevenue); setFullPayCount(fPay); setPartialPayCount(pPay);
        setMenuAggregates(agg); setMealBreakdown(mBreakdown); setDispatchSchedule(tSchedule);
      }
    } catch (err: any) { Alert.alert('Error', err.message); } finally { setLoading(false); }
  }

  function handlePrint() {
    if (Platform.OS === 'web') window.print();
    else Alert.alert('પ્રિન્ટ', 'પ્રિન્ટ કરવા માટે કૃપા કરીને વેબ બ્રાઉઝરનો ઉપયોગ કરો.');
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
          <Pressable onPress={fetchTodayData} style={[s.refreshBtn, {flex: isMobile ? 1 : undefined, alignItems: 'center'}, Platform.OS === 'web' ? {className: 'no-print'} as any : {}]}><Text style={s.refreshBtnText}>🔄 રિફ્રેશ</Text></Pressable>
        </View>
      </View>

      <View style={{flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 15}}>
        <View style={{flex: Platform.OS === 'web' ? 1 : undefined}}>
          <View {...(Platform.OS === 'web' ? { className: 'no-print' } : {})} style={{backgroundColor: '#f0fdf4', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 12}}>
             <Text style={{color: '#166534', fontWeight: 'bold', fontSize: 13}}>આજની કુલ સેવા કમાણી</Text>
             <Text style={{fontSize: 30, fontWeight: '900', color: '#047857', marginVertical: 4}}>₹ {totalRevenue.toLocaleString()}</Text>
             <Text style={{color: '#374151', fontWeight: '600'}}>કુલ મહેમાનો: {totalGuests} લોકો</Text>
          </View>
          <View style={{backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0'}}>
            <Text style={{fontSize: 18, fontWeight: '900', color: '#d97706', marginBottom: 12}}>👨‍🍳 રસોડા (Production) માટેનું લિસ્ટ</Text>
            {Object.keys(menuAggregates).length === 0 ? ( <Text style={s.muted}>આજે કોઈ જમણવાર નથી.</Text> ) : (
              <ScrollView style={{maxHeight: Platform.OS === 'web' ? 500 : undefined}}>
                {Object.keys(menuAggregates).map(type => (
                  <View key={type} style={{marginBottom: 15, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0'}}>
                    <Text style={{fontSize: 16, fontWeight: 'bold', color: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 6, marginBottom: 8}}>{type} ({mealBreakdown[type] || 0} લોકો)</Text>
                    {Object.keys(menuAggregates[type]).sort((a,b)=> dynamicSubs.indexOf(a) - dynamicSubs.indexOf(b)).map(sub => (
                      <View key={sub} style={{marginBottom: 10}}>
                        <Text style={{fontSize: 14, fontWeight: 'bold', color: '#b91c1c', marginBottom: 6}}>{sub}</Text>
                        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
                          {Object.keys(menuAggregates[type][sub]).map(itemName => (
                            <View key={itemName} style={{backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0'}}>
                              <Text style={{fontSize: 13, color: '#334155'}}><Text style={{fontWeight: 'bold', color: '#047857'}}>{itemName}</Text> ({menuAggregates[type][sub][itemName]} લોકો)</Text>
                            </View>
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
        <View style={{flex: Platform.OS === 'web' ? 2 : undefined}}>
          <View style={{backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', flex: 1}}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
              <Text style={{fontSize: 18, fontWeight: '900', color: '#1e293b'}}>🚚 સ્માર્ટ ડિસ્પેચ શિડ્યુલ</Text>
              <Text style={s.statusBadgeText}>{dispatchSchedule.length} ઓર્ડર્સ</Text>
            </View>
            {dispatchSchedule.length === 0 ? ( <Text style={s.muted}>કોઈ ડિસ્પેચ બાકી નથી.</Text> ) : (
              <ScrollView style={{maxHeight: Platform.OS === 'web' ? 800 : undefined}}>
                {dispatchSchedule.map((ds, idx) => (
                  <View key={idx} style={s.timelineCard}>
                    <View style={s.timeBadge}><Text style={{color: '#854d0e', fontWeight: 'bold', fontSize: 15}}>⏰ {ds.time}</Text></View>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                      <View style={{flex: 1}}>
                        <Text style={{fontSize: 18, fontWeight: '900', color: '#1e293b'}}>📍 {ds.placeName}</Text>
                        <Text style={{fontSize: 15, fontWeight: 'bold', color: '#047857', marginTop: 4}}>{ds.mainType} • {ds.guestsCount} લોકો</Text>
                        <View style={{marginTop: 8, padding: 8, backgroundColor: '#f1f5f9', borderRadius: 6}}>
                           <Text style={{color: '#334155', fontSize: 13}}>🍽️ {ds.items.join(', ')}</Text>
                        </View>
                      </View>
                    </View>
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

// ================= ADMIN MENU SCREEN (DYNAMIC CATS & CATEGORY MANAGER) =================
function AdminMenuScreen({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState('');
  const [mainType, setMainType] = useState('લંચ');
  const [subCategory, setSubCategory] = useState('રોટલી'); 
  const [price, setPrice] = useState(''); 
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [dynamicMainTypes, setDynamicMainTypes] = useState<string[]>(BASE_MAIN_TYPES);
  const [dynamicSubTypes, setDynamicSubTypes] = useState<string[]>(BASE_SUB_TYPES);

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});

  const [showCatManager, setShowCatManager] = useState(false);
  const [promptData, setPromptData] = useState<{visible:boolean, title:string, type:'main'|'sub'|'addMain'|'addSub', oldValue?:string, value:string}>({visible:false, title:'', type:'main', value:''});

  useEffect(() => { fetchMenu(); }, []);

  async function fetchMenu() {
    if (!supabase) return;
    const { data } = await supabase.from('menu_items').select('*').order('created_at', { ascending: false });
    if (data) {
      setMenuItems(data);
      const mains = Array.from(new Set([...BASE_MAIN_TYPES, ...data.map(d=>d.main_type).filter(Boolean)]));
      const subs = Array.from(new Set([...BASE_SUB_TYPES, ...data.map(d=>d.sub_category).filter(Boolean)]));
      setDynamicMainTypes(mains);
      setDynamicSubTypes(subs);
      if (!mains.includes(mainType)) setMainType(mains[0] || 'લંચ');
      if (!subs.includes(subCategory)) setSubCategory('રોટલી');
    }
  }

  async function saveMenu() {
    if (!name.trim() || !price || !supabase) return Alert.alert('Error', 'વાનગીનું નામ અને ભાવ લખો.');
    const finalSub = subCategory || 'રોટલી';
    const payload = { 
      name: name.trim(), main_type: mainType, meal_type: 'custom', sub_category: finalSub, price: parseFloat(price) || 0, is_active: true 
    };
    try {
      if (editingId) {
        const { error } = await supabase.from('menu_items').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('menu_items').insert([payload]);
        if (error) throw error;
      }
      setName(''); setPrice(''); setEditingId(null); fetchMenu(); Alert.alert('Success', 'વાનગી સફળતાપૂર્વક સેવ થઈ ગઈ!');
    } catch (err: any) { Alert.alert('Error', err.message); }
  }

  function openEdit(m: any) {
    setEditingId(m.id); setName(m.name); setMainType(m.main_type); setSubCategory(m.sub_category || 'રોટલી'); setPrice(m.price.toString());
    setExpandedSubs({[`${m.main_type}_${m.sub_category}`]: true});
  }

  async function toggleStatus(id: string, current: boolean) {
    if (!supabase) return;
    await supabase.from('menu_items').update({ is_active: !current }).eq('id', id);
    fetchMenu();
  }

  async function deleteMenu(id: string) {
    const msg = 'આ વાનગી કાઢી નાખવી છે?';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) { await supabase!.from('menu_items').delete().eq('id', id); fetchMenu(); }
      return;
    }
    Alert.alert('કન્ફર્મ કરો', msg, [ { text: 'ના', style: 'cancel' }, { text: 'હા, કાઢો', style: 'destructive', onPress: async () => { await supabase!.from('menu_items').delete().eq('id', id); fetchMenu(); }}]);
  }

  // --- Category Management Actions ---
  async function savePrompt() {
    if(!promptData.value.trim()) { setPromptData({...promptData, visible:false}); return; }
    if(!supabase) return;
    const newVal = promptData.value.trim();

    try {
      if(promptData.type === 'main' && promptData.oldValue) {
        await supabase.from('menu_items').update({main_type: newVal}).eq('main_type', promptData.oldValue);
      } else if (promptData.type === 'sub' && promptData.oldValue) {
        await supabase.from('menu_items').update({sub_category: newVal}).eq('sub_category', promptData.oldValue);
      } else if (promptData.type === 'addMain') {
        setMainType(newVal);
      } else if (promptData.type === 'addSub') {
        setSubCategory(newVal);
      }
      fetchMenu();
    } catch(err:any) { Alert.alert('Error', err.message); }
    setPromptData({visible:false, title:'', type:'main', value:''});
  }

  async function deleteCategory(type: 'main'|'sub', val: string) {
    const msg = `શું તમે '${val}' કાયમ માટે કાઢી નાખવા માંગો છો? તેમાં રહેલી વાનગીઓ પણ ડીલીટ થઈ જશે!`;
    if (Platform.OS === 'web' && !window.confirm(msg)) return;
    if (Platform.OS !== 'web') {
      Alert.alert('ચેતવણી', msg, [{text:'ના', style:'cancel'}, {text:'હા, ડીલીટ કરો', style:'destructive', onPress: () => execDelete(type, val)}]);
      return;
    }
    execDelete(type, val);
  }

  async function execDelete(type: 'main'|'sub', val: string) {
    if(!supabase) return;
    if(type === 'main') await supabase.from('menu_items').delete().eq('main_type', val);
    else await supabase.from('menu_items').delete().eq('sub_category', val);
    fetchMenu();
  }

  const filteredMenuItems = menuItems.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <View style={s.p18}>
      <Pressable onPress={onBack} style={s.backButton}><Text style={s.backText}>‹ પાછા</Text></Pressable>
      
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, flexWrap:'wrap', gap:10}}>
        <Text style={s.h1}>મેનૂ મેનેજમેન્ટ</Text>
        <Pressable onPress={()=>setShowCatManager(true)} style={[s.refreshBtn, {backgroundColor: '#1e293b'}]}>
          <Text style={[s.refreshBtnText, {color: '#fff'}]}>⚙️ કેટેગરી અને જમણવાર સેટિંગ્સ</Text>
        </Pressable>
      </View>

      <View style={s.formCard}>
        <Text style={s.sectionTitle}>{editingId ? 'વાનગી એડિટ કરો' : 'નવી વાનગી ઉમેરો'}</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="વાનગીનું નામ (દા.ત. રોટલી, ભાખરી)" placeholderTextColor="#9ca3af" />
        
        <Dropdown label="કયા જમણવારમાં ઉમેરવી છે?" options={dynamicMainTypes.map(t => ({label: t, value: t}))} selectedValue={mainType} onSelect={setMainType} onAddNew={()=>setPromptData({visible:true, title:'નવો જમણવાર ઉમેરો', type:'addMain', value:''})} />
        
        <Dropdown label="વાનગીનો પ્રકાર (કેટેગરી)" options={dynamicSubTypes.map(t => ({label: t, value: t}))} selectedValue={subCategory} onSelect={setSubCategory} onAddNew={()=>setPromptData({visible:true, title:'નવો વાનગીનો પ્રકાર ઉમેરો', type:'addSub', value:''})} />
        
        <TextInput style={s.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="ભાવ (₹)" placeholderTextColor="#9ca3af" onSubmitEditing={saveMenu} returnKeyType="done" />
        <Pressable onPress={saveMenu} style={s.primary}><Text style={s.primaryText}>{editingId ? 'ફેરફાર સેવ કરો (Enter)' : '＋ વાનગી ઉમેરો (Enter)'}</Text></Pressable>
        {editingId && <Pressable onPress={()=>{setEditingId(null); setName(''); setPrice('');}} style={s.closeButton}><Text>કેન્સલ એડિટિંગ</Text></Pressable>}
      </View>
      
      <Text style={[s.h1, {marginTop: 20}]}>તમામ મેનૂ</Text>
      <TextInput style={[s.input, {borderColor: '#047857', borderWidth: 2}]} placeholder="🔍 અહીં વાનગીનું નામ શોધો..." placeholderTextColor="#9ca3af" value={searchQuery} onChangeText={setSearchQuery} />

      {dynamicMainTypes.map(type => {
        const itemsInType = filteredMenuItems.filter(m => m.main_type === type);
        if (itemsInType.length === 0) return null;
        
        const distinctSubs = Array.from(new Set(itemsInType.map(i => i.sub_category).filter(Boolean)));

        return (
          <View key={type} style={{marginBottom: 20}}>
            <Text style={s.mainTypeHeader}>{type}</Text>
            {distinctSubs.map(sub => {
              const itemsInSub = itemsInType.filter(m => m.sub_category === sub);
              if (itemsInSub.length === 0) return null;
              const key = `${type}_${sub}`;
              const isExpanded = expandedSubs[key] || searchQuery.length > 0;
              return (
                <View key={sub} style={{marginLeft: 10, marginBottom: 10}}>
                  <Pressable onPress={() => setExpandedSubs(p=>({...p, [key]:!p[key]}))} style={s.collapsibleHeader}>
                     <Text style={s.collapsibleHeaderText}>{sub} ({itemsInSub.length})</Text>
                     <Text style={s.collapsibleHeaderIcon}>{isExpanded ? '▲' : '▼'}</Text>
                  </Pressable>
                  {isExpanded && (
                    <View style={{paddingLeft: 10, paddingTop: 10}}>
                      {itemsInSub.map(m => (
                        <View key={m.id} style={s.listCard}>
                          <View style={{flex:1}}><Text style={{fontWeight:'bold', color: m.is_active?'#1e293b':'#94a3b8', textDecorationLine: m.is_active?'none':'line-through'}}>{m.name}</Text><Text style={{color:'#047857', fontWeight:'bold', marginTop: 2}}>₹{m.price}</Text></View>
                          <View style={{alignItems: 'flex-end', gap: 6}}>
                             <View style={[s.statusBadge, {backgroundColor: m.is_active ? '#f0fdf4' : '#fef2f2'}]}><Text style={{color: m.is_active ? '#047857' : '#dc2626', fontWeight:'bold', fontSize: 12}}>{m.is_active ? 'Active' : 'Inactive'}</Text></View>
                             <View style={{flexDirection:'row', gap: 5}}>
                              <Pressable onPress={() => openEdit(m)} style={s.editBtn}><Text>✏️</Text></Pressable>
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
           <View style={[s.header, {paddingTop: Platform.OS==='web'?20:0}]}><Text style={s.h1}>કેટેગરી મેનેજમેન્ટ</Text><Pressable onPress={()=>setShowCatManager(false)}><Text style={{fontSize:24, color:'#64748b'}}>✕</Text></Pressable></View>
           <ScrollView contentContainerStyle={[s.webContainer, s.p18]}>
              <View style={s.formCard}>
                <Text style={s.sectionTitle}>જમણવાર ના પ્રકાર (Meal Types)</Text>
                {dynamicMainTypes.map(t => (
                  <View key={t} style={{flexDirection:'row', justifyContent:'space-between', paddingVertical:12, borderBottomWidth:1, borderColor:'#eee', alignItems:'center'}}>
                    <Text style={{fontSize:16, fontWeight:'bold', color:'#1e293b'}}>{t}</Text>
                    <View style={{flexDirection:'row', gap:8}}>
                       <Pressable onPress={()=>setPromptData({visible:true, title:'જમણવાર એડિટ કરો', type:'main', oldValue:t, value:t})} style={s.editBtn}><Text style={s.editBtnText}>✏️ એડિટ</Text></Pressable>
                       <Pressable onPress={()=>deleteCategory('main', t)} style={[s.editBtn, {borderColor:'#fca5a5', backgroundColor:'#fef2f2'}]}><Text style={[s.editBtnText, {color:'#dc2626'}]}>🗑️ ડીલીટ</Text></Pressable>
                    </View>
                  </View>
                ))}
              </View>

              <View style={[s.formCard, {marginTop: 20}]}>
                <Text style={s.sectionTitle}>વાનગી ના પ્રકાર (Categories)</Text>
                {dynamicSubTypes.map(t => (
                  <View key={t} style={{flexDirection:'row', justifyContent:'space-between', paddingVertical:12, borderBottomWidth:1, borderColor:'#eee', alignItems:'center'}}>
                    <Text style={{fontSize:16, fontWeight:'bold', color:'#1e293b'}}>{t}</Text>
                    <View style={{flexDirection:'row', gap:8}}>
                       <Pressable onPress={()=>setPromptData({visible:true, title:'વાનગીનો પ્રકાર એડિટ કરો', type:'sub', oldValue:t, value:t})} style={s.editBtn}><Text style={s.editBtnText}>✏️ એડિટ</Text></Pressable>
                       <Pressable onPress={()=>deleteCategory('sub', t)} style={[s.editBtn, {borderColor:'#fca5a5', backgroundColor:'#fef2f2'}]}><Text style={[s.editBtnText, {color:'#dc2626'}]}>🗑️ ડીલીટ</Text></Pressable>
                    </View>
                  </View>
                ))}
              </View>
           </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={promptData.visible} transparent animationType="fade">
        <View style={s.modalBg}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>{promptData.title}</Text>
            <TextInput style={s.input} value={promptData.value} onChangeText={(v)=>setPromptData({...promptData, value:v})} onSubmitEditing={savePrompt} returnKeyType="done" autoFocus />
            <Pressable onPress={savePrompt} style={s.primary}><Text style={s.primaryText}>સેવ કરો (Enter)</Text></Pressable>
            <Pressable onPress={()=>setPromptData({visible:false, title:'', type:'main', value:''})} style={s.closeButton}><Text style={s.closeText}>કેન્સલ</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ================= ADMIN PLACES SCREEN =================
function AdminPlacesScreen({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState(''); const [places, setPlaces] = useState<any[]>([]); const [editingId, setEditingId] = useState<string | null>(null);
  useEffect(() => { fetchPlaces(); }, []);
  async function fetchPlaces() { if (!supabase) return; const { data } = await supabase.from('places').select('*').order('created_at', { ascending: true }); if (data) setPlaces(data); }
  async function savePlace() {
    if (!name.trim() || !supabase) return Alert.alert('Error', 'સ્થળનું નામ લખો');
    if (editingId) await supabase.from('places').update({ name: name.trim() }).eq('id', editingId); else await supabase.from('places').insert([{ name: name.trim(), is_active: true }]);
    setName(''); setEditingId(null); fetchPlaces();
  }
  async function toggleStatus(id: string, current: boolean) { await supabase!.from('places').update({ is_active: !current }).eq('id', id); fetchPlaces(); }
  async function deletePlace(id: string) {
    const msg = 'આ સ્થળ કાઢી નાખવું છે?';
    if (Platform.OS === 'web') { if (window.confirm(msg)) { await supabase!.from('places').delete().eq('id', id); fetchPlaces(); } return; }
    Alert.alert('કન્ફર્મ', msg, [{ text: 'ના' }, { text: 'હા', style: 'destructive', onPress: async () => { await supabase!.from('places').delete().eq('id', id); fetchPlaces(); }}]);
  }
  return (
    <View style={s.p18}>
      <Pressable onPress={onBack} style={s.backButton}><Text style={s.backText}>‹ પાછા</Text></Pressable>
      <Text style={s.h1}>સ્થળ મેનેજમેન્ટ</Text>
      <View style={s.formCard}>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="સ્થળનું નામ" onSubmitEditing={savePlace} returnKeyType="done" />
        <Pressable onPress={savePlace} style={s.primary}><Text style={s.primaryText}>સેવ કરો (Enter)</Text></Pressable>
        {editingId && <Pressable onPress={()=>{setEditingId(null); setName('');}} style={s.closeButton}><Text>કેન્સલ</Text></Pressable>}
      </View>
      {places.map(p => (
        <View key={p.id} style={s.listCard}>
          <Text style={{fontWeight:'bold', fontSize: 16, textDecorationLine: p.is_active?'none':'line-through'}}>{p.name}</Text>
          <View style={{flexDirection: 'row', gap: 5}}>
            <Pressable onPress={() => {setEditingId(p.id); setName(p.name);}} style={s.editBtn}><Text>✏️</Text></Pressable>
            <Pressable onPress={() => toggleStatus(p.id, p.is_active)} style={s.editBtn}><Text>{p.is_active?'બંધ':'ચાલુ'}</Text></Pressable>
            <Pressable onPress={() => deletePlace(p.id)} style={[s.editBtn, {backgroundColor: '#fef2f2'}]}><Text style={{color:'#dc2626'}}>🗑️</Text></Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

// ================= ADMIN USERS (MULTIPLE PLACES SUPPORT) =================
function AdminUsersScreen({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<any[]>([]); 
  const [places, setPlaces] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false); 
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState(''); const [mobile, setMobile] = useState(''); const [role, setRole] = useState<Role>('counter');
  const [selectedDutyPlaces, setSelectedDutyPlaces] = useState<string[]>([]); 
  const [photoUrl, setPhotoUrl] = useState(''); 
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
             else if(typeof u.duty_places === 'string') {
                try { pList = JSON.parse(u.duty_places); } catch(e) { pList = [u.duty_places]; }
             }
          } else if (u.duty_place) {
             pList = [u.duty_place];
          }
          return {...u, duty_places: pList};
       });
       setUsers(mappedUsers); 
    }
    if (pData) setPlaces(pData);
  }

  function openEdit(u: any) {
    setEditingId(u.id); setName(u.full_name || ''); setMobile(u.mobile || '');
    setRole(u.role); setSelectedDutyPlaces(u.duty_places || []); setPhotoUrl(u.photo_url || '');
    setLoginEmail(u.login_email || ''); setLoginPass('');
    setShowForm(true);
  }

  async function toggleStatus(id: string, current: boolean) { await supabase!.from('profiles').update({ is_active: !current }).eq('id', id); fetchData(); }
  
  async function deleteUser(id: string) { 
    if(Platform.OS==='web') { 
        if(window.confirm('આ યુઝર કાઢી નાખવો છે?')){ await supabase!.from('profiles').delete().eq('id', id); fetchData();} 
    } else { 
        Alert.alert('કન્ફર્મ કરો', 'આ યુઝર કાઢી નાખવો છે?', [{text:'ના'}, {text:'હા', style: 'destructive', onPress:async ()=>{await supabase!.from('profiles').delete().eq('id', id); fetchData();}}]); 
    } 
  }
  
  async function saveUser() {
    if (!name || !loginEmail || (!loginPass && !editingId)) return Alert.alert('Error', 'નામ અને યુઝર ID ફરજિયાત છે.');
    if (role === 'counter' && selectedDutyPlaces.length === 0) return Alert.alert('Error', 'કેશ કાઉન્ટર માટે ઓછામાં ઓછું એક સ્થળ પસંદ કરવું ફરજિયાત છે.');
    if (!supabase) return;
    
    const authEmail = loginEmail.includes('@') ? loginEmail.toLowerCase() : `${loginEmail.toLowerCase()}@baps.local`;
    const payload: any = { full_name: name, mobile, role, duty_places: selectedDutyPlaces, photo_url: photoUrl, login_email: loginEmail, is_active: true };
    if (loginPass) payload.login_pass = loginPass;
    
    if (editingId) {
      const { error } = await supabase.from('profiles').update(payload).eq('id', editingId);
      if(error) Alert.alert('Error', error.message);
      else Alert.alert('Success', 'યુઝરની ડિટેલ અપડેટ થઈ ગઈ!');
    } else {
      const { data, error } = await supabase.auth.signUp({ email: authEmail, password: loginPass });
      if (error) return Alert.alert('Auth Error', error.message);
      if (data.user) await supabase.from('profiles').insert([{ id: data.user.id, ...payload }]);
      Alert.alert('Success', 'નવો યુઝર ઉમેરાઈ ગયો!');
    }
    setShowForm(false); setEditingId(null); fetchData();
  }

  function togglePlaceSelection(placeId: string) {
    if (selectedDutyPlaces.includes(placeId)) {
        setSelectedDutyPlaces(selectedDutyPlaces.filter(id => id !== placeId));
    } else {
        setSelectedDutyPlaces([...selectedDutyPlaces, placeId]);
    }
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
          <Dropdown label="રોલ (Role)" options={[{label:'Super Admin', value:'admin'}, {label:'Cash Counter', value:'counter'}, {label:'Production (રસોડું)', value:'production'}, {label:'Dispatch', value:'dispatch'}]} selectedValue={role} onSelect={setRole} />
          
          <Text style={s.label}>આ કાઉન્ટર માટે કયા સ્થળ માન્ય છે? (એકથી વધુ સિલેક્ટ કરી શકાય)</Text>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15, padding: 10, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0'}}>
             {places.map(p => {
                 const isSelected = selectedDutyPlaces.includes(p.id);
                 return (
                     <Pressable key={p.id} onPress={() => togglePlaceSelection(p.id)} style={[s.chip, isSelected && s.chipSelected]}>
                         <Text style={[s.chipText, isSelected && s.chipTextSelected]}>{p.name}</Text>
                     </Pressable>
                 )
             })}
          </View>
          
          <Text style={[s.sectionTitle, {marginTop: 15}]}>લોગિન માટેની વિગતો</Text>
          <TextInput style={s.input} value={loginEmail} onChangeText={setLoginEmail} placeholder="યુઝર ID (દા.ત. Rasodu1)" autoCapitalize="none" />
          <TextInput style={s.input} value={loginPass} onChangeText={setLoginPass} placeholder={editingId ? "નવો પાસવર્ડ (બદલવો હોય તો જ લખો)" : "લોગિન પાસવર્ડ"} onSubmitEditing={saveUser} returnKeyType="done" />

          <Pressable onPress={saveUser} style={s.primary}><Text style={s.primaryText}>યુઝર સેવ કરો (Enter)</Text></Pressable>
          <Pressable onPress={() => {setShowForm(false); setEditingId(null);}} style={[s.closeButton, {marginTop: 5}]}><Text style={s.closeText}>કેન્સલ</Text></Pressable>
        </View>
      ) : (
        <Pressable onPress={() => {setEditingId(null); setName(''); setMobile(''); setLoginEmail(''); setLoginPass(''); setSelectedDutyPlaces([]); setShowForm(true);}} style={[s.primary, {backgroundColor: '#4f46e5'}]}><Text style={s.primaryText}>＋ નવો યુઝર બનાવો</Text></Pressable>
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
                  <Pressable onPress={() => openEdit(u)} style={s.editBtn}><Text style={s.editBtnText}>✏️ એડિટ</Text></Pressable>
                  <Pressable onPress={() => deleteUser(u.id)} style={[s.editBtn, {backgroundColor: '#fef2f2', borderColor: '#fca5a5'}]}><Text style={{color:'#dc2626'}}>🗑️</Text></Pressable>
                </View>
              </View>
            </View>
          );
      })}
    </View>
  );
}

  function togglePlaceSelection(placeId: string) {
    if (selectedDutyPlaces.includes(placeId)) {
        setSelectedDutyPlaces(selectedDutyPlaces.filter(id => id !== placeId));
    } else {
        setSelectedDutyPlaces([...selectedDutyPlaces, placeId]);
    }
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
          <Dropdown label="રોલ (Role)" options={[{label:'Super Admin', value:'admin'}, {label:'Cash Counter', value:'counter'}, {label:'Production (રસોડું)', value:'production'}, {label:'Dispatch', value:'dispatch'}]} selectedValue={role} onSelect={setRole} />
          
          <Text style={s.label}>આ કાઉન્ટર માટે કયા સ્થળ માન્ય છે? (એકથી વધુ સિલેક્ટ કરી શકાય)</Text>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15, padding: 10, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0'}}>
             {places.map(p => {
                 const isSelected = selectedDutyPlaces.includes(p.id);
                 return (
                     <Pressable key={p.id} onPress={() => togglePlaceSelection(p.id)} style={[s.chip, isSelected && s.chipSelected]}>
                         <Text style={[s.chipText, isSelected && s.chipTextSelected]}>{p.name}</Text>
                     </Pressable>
                 )
             })}
          </View>
          
          <Text style={[s.sectionTitle, {marginTop: 15}]}>લોગિન માટેની વિગતો</Text>
          <TextInput style={s.input} value={loginEmail} onChangeText={setLoginEmail} placeholder="યુઝર ID (દા.ત. Rasodu1)" autoCapitalize="none" />
          <TextInput style={s.input} value={loginPass} onChangeText={setLoginPass} placeholder={editingId ? "નવો પાસવર્ડ (બદલવો હોય તો જ લખો)" : "લોગિન પાસવર્ડ"} onSubmitEditing={saveUser} returnKeyType="done" />

          <Pressable onPress={saveUser} style={s.primary}><Text style={s.primaryText}>યુઝર સેવ કરો (Enter)</Text></Pressable>
          <Pressable onPress={() => {setShowForm(false); setEditingId(null);}} style={[s.closeButton, {marginTop: 5}]}><Text style={s.closeText}>કેન્સલ</Text></Pressable>
        </View>
      ) : (
        <Pressable onPress={() => {setEditingId(null); setName(''); setMobile(''); setLoginEmail(''); setLoginPass(''); setSelectedDutyPlaces([]); setShowForm(true);}} style={[s.primary, {backgroundColor: '#4f46e5'}]}><Text style={s.primaryText}>＋ નવો યુઝર બનાવો</Text></Pressable>
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
                  <Pressable onPress={() => openEdit(u)} style={s.editBtn}><Text style={s.editBtnText}>✏️ એડિટ</Text></Pressable>
                  <Pressable onPress={() => deleteUser(u.id)} style={[s.editBtn, {backgroundColor: '#fef2f2', borderColor: '#fca5a5'}]}><Text style={{color:'#dc2626'}}>🗑️</Text></Pressable>
                </View>
              </View>
            </View>
          );
      })}
    </View>
  );
}
  function openEdit(u: any) {
    setEditingId(u.id); setName(u.full_name || ''); setMobile(u.mobile || '');
    setRole(u.role); setSelectedDutyPlaces(u.duty_places || []); setPhotoUrl(u.photo_url || '');
    setLoginEmail(u.login_email || ''); setLoginPass(u.login_pass || '');
    setShowForm(true);
  }

  async function toggleStatus(id: string, current: boolean) { await supabase!.from('profiles').update({ is_active: !current }).eq('id', id); fetchData(); }
  async function deleteUser(id: string) { if(Platform.OS==='web') { if(window.confirm('Delete?')){ await supabase!.from('profiles').delete().eq('id', id); fetchData();} } else { Alert.alert('Delete?', '', [{text:'No'}, {text:'Yes', onPress:async ()=>{await supabase!.from('profiles').delete().eq('id', id); fetchData();}}]); } }
  
  async function saveUser() {
    if (!name || !loginEmail || (!loginPass && !editingId)) return Alert.alert('Error', 'નામ અને યુઝર ID ફરજિયાત છે.');
    if (role === 'counter' && selectedDutyPlaces.length === 0) return Alert.alert('Error', 'કેશ કાઉન્ટર માટે ઓછામાં ઓછું એક સ્થળ પસંદ કરવું ફરજિયાત છે.');
    if (!supabase) return;
    
    const authEmail = loginEmail.includes('@') ? loginEmail.toLowerCase() : `${loginEmail.toLowerCase()}@baps.local`;
    const payload: any = { full_name: name, mobile, role, duty_places: selectedDutyPlaces, photo_url: photoUrl, login_email: loginEmail, is_active: true };
    if (loginPass) payload.login_pass = loginPass;
    
    if (editingId) {
      const { error } = await supabase.from('profiles').update(payload).eq('id', editingId);
      if(error) Alert.alert('Error', error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email: authEmail, password: loginPass });
      if (error) return Alert.alert('Auth Error', error.message);
      if (data.user) await supabase.from('profiles').insert([{ id: data.user.id, ...payload }]);
    }
    setShowForm(false); setEditingId(null); fetchData();
  }

  function togglePlaceSelection(placeId: string) {
    if (selectedDutyPlaces.includes(placeId)) {
        setSelectedDutyPlaces(selectedDutyPlaces.filter(id => id !== placeId));
    } else {
        setSelectedDutyPlaces([...selectedDutyPlaces, placeId]);
    }
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
          <Dropdown label="રોલ (Role)" options={[{label:'Super Admin', value:'admin'}, {label:'Cash Counter', value:'counter'}, {label:'Production (રસોડું)', value:'production'}, {label:'Dispatch', value:'dispatch'}]} selectedValue={role} onSelect={setRole} />
          
          <Text style={s.label}>આ કાઉન્ટર માટે કયા સ્થળ માન્ય છે? (એકથી વધુ સિલેક્ટ કરી શકાય)</Text>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15, padding: 10, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0'}}>
             {places.map(p => {
                 const isSelected = selectedDutyPlaces.includes(p.id);
                 return (
                     <Pressable key={p.id} onPress={() => togglePlaceSelection(p.id)} style={[s.chip, isSelected && s.chipSelected]}>
                         <Text style={[s.chipText, isSelected && s.chipTextSelected]}>{p.name}</Text>
                     </Pressable>
                 )
             })}
          </View>
          
          <Text style={[s.sectionTitle, {marginTop: 15}]}>લોગિન માટેની વિગતો</Text>
          <TextInput style={s.input} value={loginEmail} onChangeText={setLoginEmail} placeholder="યુઝર ID (દા.ત. Rasodu1)" autoCapitalize="none" />
          <TextInput style={s.input} value={loginPass} onChangeText={setLoginPass} placeholder={editingId ? "નવો પાસવર્ડ (બદલવો હોય તો જ લખો)" : "લોગિન પાસવર્ડ"} onSubmitEditing={saveUser} returnKeyType="done" />

          <Pressable onPress={saveUser} style={s.primary}><Text style={s.primaryText}>યુઝર સેવ કરો (Enter)</Text></Pressable>
          <Pressable onPress={() => {setShowForm(false); setEditingId(null);}} style={[s.closeButton, {marginTop: 5}]}><Text style={s.closeText}>કેન્સલ</Text></Pressable>
        </View>
      ) : (
        <Pressable onPress={() => {setEditingId(null); setName(''); setMobile(''); setLoginEmail(''); setLoginPass(''); setSelectedDutyPlaces([]); setShowForm(true);}} style={[s.primary, {backgroundColor: '#4f46e5'}]}><Text style={s.primaryText}>＋ નવો યુઝર બનાવો</Text></Pressable>
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
                  <Pressable onPress={() => openEdit(u)} style={s.editBtn}><Text style={s.editBtnText}>✏️ એડિટ</Text></Pressable>
                  <Pressable onPress={() => deleteUser(u.id)} style={[s.editBtn, {backgroundColor: '#fef2f2', borderColor: '#fca5a5'}]}><Text style={{color:'#dc2626'}}>🗑️</Text></Pressable>
                </View>
              </View>
            </View>
          );
      })}
    </View>
  );
}

// ================= COUNTER MODULE =================
function CounterHome({ session, profile }: { session: Session, profile: Profile }) {
  const [activeTab, setActiveTab] = useState<'home'|'new_booking'|'all_bookings'>('home');
  const [stats, setStats] = useState({ count: 0, lifetimeGuests: 0 }); 
  const [todaysMeals, setTodaysMeals] = useState<any[]>([]);
  const [todayGuestsTotal, setTodayGuestsTotal] = useState(0);
  const [todayGuestsByMeal, setTodayGuestsByMeal] = useState<Record<string, number>>({});
  const [places, setPlaces] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);

  const myDutyPlaces = profile.duty_places || [];

  useEffect(() => { if (activeTab === 'home') fetchDashboard(); }, [activeTab]);

  async function fetchDashboard() {
    if (!supabase) return;
    setRefreshing(true);
    try {
      // Counter only sees bookings from their assigned multiple places
      let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });
      
      if (myDutyPlaces.length > 0) {
        // Build an OR filter for all allowed places
        const orQuery = myDutyPlaces.map(p => `place_id.eq.${p}`).join(',');
        query = query.or(orQuery);
      } else {
        // If no duty places assigned, show nothing to be safe.
        query = query.eq('id', '00000000-0000-0000-0000-000000000000'); 
      }
      
      const { data, error } = await query;
      const { data: pData } = await supabase.from('places').select('*');
      if (error) throw error;
      
      if (data) {
        let totalAllGuests = 0; let todayGTotal = 0; let mealMap: Record<string, number> = {};
        const todayStr = getTodayStr();

        data.forEach(b => {
          if (b.meals) {
            b.meals.forEach((m: any) => {
              const g = m.guestsCount || 0;
              totalAllGuests += g;
              if (m.date === todayStr) {
                todayGTotal += g;
                mealMap[m.mainType] = (mealMap[m.mainType] || 0) + g;
              }
            });
          }
        });

        setStats({ count: data.length, lifetimeGuests: totalAllGuests });
        setTodayGuestsTotal(todayGTotal); setTodayGuestsByMeal(mealMap);

        const todaysBookings = data.filter(b => b.meals?.some((m:any) => m.date === todayStr));
        setTodaysMeals(todaysBookings); 
      }
      if (pData) setPlaces(pData);
    } catch (err: any) { Alert.alert('Database Fetch Error', err.message); } finally { setRefreshing(false); }
  }

  async function deleteBooking(id: string) {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete?')) { await supabase!.from('bookings').delete().eq('id', id); fetchDashboard(); }
    } else {
      Alert.alert('કન્ફર્મ', 'Delete?', [{ text: 'ના' }, { text: 'હા', style: 'destructive', onPress: async () => { await supabase!.from('bookings').delete().eq('id', id); fetchDashboard(); }}]);
    }
  }

  if (editingBooking) return <BookingScreen onBack={() => { setEditingBooking(null); fetchDashboard(); }} session={session} profile={profile} initialData={editingBooking} allowedPlaces={places.filter(p=>myDutyPlaces.includes(p.id))} />;
  if (activeTab === 'new_booking') return <BookingScreen onBack={() => {setActiveTab('home'); fetchDashboard();}} session={session} profile={profile} allowedPlaces={places.filter(p=>myDutyPlaces.includes(p.id))} />;
  if (activeTab === 'all_bookings') return <AllBookingsScreen onBack={() => {setActiveTab('home'); fetchDashboard();}} session={session} profile={profile} isAdmin={false} />;

  const myPlaceNames = places.filter(p=>myDutyPlaces.includes(p.id)).map(p=>p.name).join(', ') || 'Unknown Location';

  return (
    <View style={s.p18}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <Text style={s.h1}>કેશ કાઉન્ટર</Text>
      </View>
      <Text style={{color: '#0369a1', fontSize: 13, fontWeight: 'bold', marginBottom: 15}}>📍 {myPlaceNames}</Text>
      
      <View style={s.grid}>
        <Card title="કુલ બુકિંગ્સ (Lifetime)" icon="📋" value={stats.count.toString()} />
        <Card title="અત્યાર સુધીના કુલ યજમાનો" icon="👥" value={stats.lifetimeGuests.toLocaleString()} />
      </View>

      <View style={[s.todayGuestsCard, {marginBottom: 16}]}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}><Text style={{fontSize: 22}}>🍽️</Text><Text style={{fontSize: 17, fontWeight: '900', color: '#065f46'}}>આજના યજમાનો</Text></View>
          <Text style={{color: '#047857', fontWeight: 'bold', fontSize: 13}}>🗓️ {getTodayStr()}</Text>
        </View>

        {Object.keys(todayGuestsByMeal).length === 0 ? ( <Text style={{color: '#64748b', fontSize: 14, marginTop: 4}}>આજે કોઈ જમણવાર નોંધાયેલ નથી.</Text> ) : (
          <View style={{marginTop: 6}}>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10}}>
              {Object.keys(todayGuestsByMeal).map(mType => (
                <View key={mType} style={s.mealPill}>
                  <Text style={{fontSize: 14, color: '#1e293b'}}><Text style={{fontWeight: '900', color: '#047857'}}>{mType}:</Text> {todayGuestsByMeal[mType]} લોકો</Text>
                </View>
              ))}
            </View>
            <View style={{borderTopWidth: 1, borderTopColor: '#a7f3d0', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
              <Text style={{fontSize: 15, fontWeight: '800', color: '#065f46'}}>👉 આજના કુલ યજમાન:</Text>
              <Text style={{fontSize: 24, fontWeight: '900', color: '#047857'}}>{todayGuestsTotal.toLocaleString()} લોકો</Text>
            </View>
          </View>
        )}
      </View>

      <Pressable onPress={() => setActiveTab('new_booking')} style={[s.primary, {marginBottom: 20}]}><Text style={s.primaryText}>＋ નવી બુકિંગ બનાવો</Text></Pressable>
      
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
        <Text style={s.sectionTitle}>આજની તારીખના જમણવાર ({todaysMeals.length})</Text>
        <Pressable onPress={fetchDashboard} style={s.refreshBtn}><Text style={s.refreshBtnText}>{refreshing ? 'Loading...' : '🔄 રિફ્રેશ'}</Text></Pressable>
      </View>

      {todaysMeals.length === 0 ? <Text style={s.muted}>આજે કોઈ જમણવાર નથી.</Text> : null}
      
      {todaysMeals.map(b => <BookingCard key={b.id} b={b} places={places} isAdmin={false} onEdit={setEditingBooking} onDelete={deleteBooking} /> )}

      <Pressable onPress={() => setActiveTab('all_bookings')} style={[s.primary, {backgroundColor: '#ffffff', borderWidth: 2, borderColor:'#047857', borderStyle:'dashed', marginTop: 12}]}>
        <Text style={{color:'#047857', fontWeight:'bold', textAlign: 'center', fontSize: 16}}>📋 બધા બુકિંગ્સ જુઓ (View All)</Text>
      </Pressable>
    </View>
  );
}

// ================= ALL BOOKINGS MODULE (INCLUDES TODAY) =================
function AllBookingsScreen({ onBack, session, profile, isAdmin }: { onBack: () => void, session: Session, profile: Profile, isAdmin: boolean }) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [places, setPlaces] = useState<any[]>([]);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchBookings(); }, []);
  
  async function fetchBookings() {
    if (!supabase) return;
    setRefreshing(true);
    try {
      let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });
      
      if (profile.role === 'counter') {
          const myDutyPlaces = profile.duty_places || [];
          if (myDutyPlaces.length > 0) {
              const orQuery = myDutyPlaces.map(p => `place_id.eq.${p}`).join(',');
              query = query.or(orQuery);
          } else {
              query = query.eq('id', '00000000-0000-0000-0000-000000000000'); 
          }
      }

      const { data, error } = await query;
      const { data: pData } = await supabase.from('places').select('*');
      if (error) throw error;
      if (data) {
        const sorted = data.sort((a,b) => {
          const aDate = a.meals && a.meals[0] ? a.meals[0].date.split('-').reverse().join('') : '0';
          const bDate = b.meals && b.meals[0] ? b.meals[0].date.split('-').reverse().join('') : '0';
          return bDate.localeCompare(aDate);
        });
        setBookings(sorted);
      }
      if (pData) setPlaces(pData);
    } catch(err: any) { Alert.alert('Fetch Error', err.message); } finally { setRefreshing(false); }
  }

  async function deleteBooking(id: string) {
    if (Platform.OS === 'web') { if (window.confirm('Delete?')) { await supabase!.from('bookings').delete().eq('id', id); fetchBookings(); } } 
    else { Alert.alert('કન્ફર્મ', 'Delete?', [{ text: 'ના' }, { text: 'હા', style: 'destructive', onPress: async () => { await supabase!.from('bookings').delete().eq('id', id); fetchBookings(); }}]); }
  }

  // Pass allowedPlaces to BookingScreen if counter
  const allowedPlaces = (profile.role === 'counter') ? places.filter(p=> (profile.duty_places || []).includes(p.id)) : places;

  if (editingBooking) return <BookingScreen onBack={() => { setEditingBooking(null); fetchBookings(); }} session={session} profile={profile} initialData={editingBooking} allowedPlaces={allowedPlaces} />;

  return (
    <View style={s.p18}>
      <Pressable onPress={onBack} style={s.backButton}><Text style={s.backText}>‹ પાછા ડેશબોર્ડ પર</Text></Pressable>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
        <Text style={s.h1}>બધા બુકિંગ્સ (આજના સહિત)</Text>
        <Pressable onPress={fetchBookings} style={s.refreshBtn}><Text style={s.refreshBtnText}>{refreshing ? 'Loading...' : '🔄 રિફ્રેશ કરો'}</Text></Pressable>
      </View>
      
      {bookings.length === 0 ? <Text style={s.muted}>કોઈ બુકિંગ જોવા મળ્યા નથી.</Text> : null}
      
      {bookings.map(b => (
        <BookingCard key={b.id} b={b} places={places} isAdmin={isAdmin} onEdit={setEditingBooking} onDelete={deleteBooking} />
      ))}
    </View>
  );
}

// ================= BOOKING SCREEN (COUNTER PLACE LOCK) =================
function BookingScreen({ onBack, session, profile, initialData, allowedPlaces }: { onBack: () => void, session: Session, profile: Profile, initialData?: any, allowedPlaces?: any[] }) {
  const [places, setPlaces] = useState<any[]>(allowedPlaces || []);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState(initialData?.name || ''); const [father, setFather] = useState(initialData?.father || '');
  const [surname, setSurname] = useState(initialData?.surname || ''); const [mobile, setMobile] = useState(initialData?.mobile || '');
  
  // Logic for default selected place
  let defaultPlace = initialData?.place_id || null;
  if (!defaultPlace && profile.role === 'counter' && allowedPlaces && allowedPlaces.length === 1) {
      defaultPlace = allowedPlaces[0].id;
  }
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(defaultPlace);
  
  const [meals, setMeals] = useState<any[]>(initialData?.meals || []);
  const [showMealBuilder, setShowMealBuilder] = useState(false);
  const [editingMealIndex, setEditingMealIndex] = useState<number | null>(null);

  const [thakorjiSeva, setThakorjiSeva] = useState(initialData?.thakorji_seva?.toString() || '0'); 
  const [receiptNo, setReceiptNo] = useState(initialData?.receipt_no || '');
  const [paymentStatus, setPaymentStatus] = useState(initialData?.payment_status || 'Full'); 

  useEffect(() => {
    async function fetchData() {
      if (!supabase) return;
      if (!allowedPlaces) {
          const { data: pData } = await supabase.from('places').select('*').eq('is_active', true);
          if (pData) setPlaces(pData.map(p => ({ label: p.name, value: p.id })));
      } else {
          setPlaces(allowedPlaces.map(p => ({ label: p.name || p.label, value: p.id || p.value })));
      }
      
      const { data: mData } = await supabase.from('menu_items').select('*').eq('is_active', true);
      if (mData) setMenuItems(mData);
    }
    fetchData();
  }, []);

  let mealsTotal = 0;
  meals.forEach(m => mealsTotal += (m.ratePerPlate * (m.guestsCount || 0)));
  const grandTotal = mealsTotal + (parseInt(thakorjiSeva) || 0); 
  const diffTotal = grandTotal - (initialData ? (initialData.grand_total || 0) : 0);

  function saveMealData(mealData: any) {
    if (editingMealIndex !== null) { const updated = [...meals]; updated[editingMealIndex] = mealData; setMeals(updated); } 
    else { setMeals([...meals, mealData]); }
    setEditingMealIndex(null);
  }

  async function handleSaveBooking() {
    if (!name || !mobile || meals.length === 0) return Alert.alert('અધૂરી માહિતી', 'નામ, નંબર અને 1 જમણવાર જરૂરી છે.');
    if (!selectedPlaceId) return Alert.alert('ભૂલ', 'બુકિંગ માટે સ્થળ પસંદ કરવું ફરજિયાત છે.');
    if (mobile.length !== 10) return Alert.alert('ભૂલ', 'મોબાઈલ નંબર 10 આંકડાનો હોવો જોઈએ.');
    if (!supabase) return;

    setSaving(true);
    try {
      const payload = {
        name, father, surname, mobile, place_id: selectedPlaceId, 
        meals, rasoi_seva: 0, thakorji_seva: (parseInt(thakorjiSeva) || 0),
        receipt_no: receiptNo, payment_status: paymentStatus, grand_total: grandTotal, user_id: session.user.id
      };
      const res = initialData?.id ? await supabase.from('bookings').update(payload).eq('id', initialData.id).select() : await supabase.from('bookings').insert([payload]).select();
      if (res.error) throw res.error;
      Alert.alert('સફળતા', `બુકિંગ સેવ થઈ ગયું!`);
      onBack();
    } catch (err: any) { Alert.alert('Error', err.message); } finally { setSaving(false); }
  }

  return (
    <View style={s.p18}>
      <Pressable onPress={onBack} style={s.backButton}><Text style={s.backText}>‹ પાછા</Text></Pressable>
      <Text style={s.h1}>{initialData ? 'બુકિંગ એડિટ કરો' : 'નવી રસોઈ સેવા બુકિંગ'}</Text>
      
      <View style={s.formCard}>
        <Text style={s.sectionTitle}>1. યજમાનની વિગતો</Text>
        <TextInput placeholder="નામ" style={s.input} value={name} onChangeText={setName} />
        <TextInput placeholder="પિતાનું નામ" style={s.input} value={father} onChangeText={setFather} />
        <TextInput placeholder="અટક" style={s.input} value={surname} onChangeText={setSurname} />
        <TextInput placeholder="મોબાઇલ નંબર (૧૦ આંકડા)" style={s.input} keyboardType="phone-pad" maxLength={10} value={mobile} onChangeText={setMobile} />
        
        {places.length === 1 ? (
           <View style={{marginBottom: 14}}>
             <Text style={s.label}>બુકિંગ સ્થળ</Text>
             <TextInput style={[s.input, {backgroundColor: '#f1f5f9', color: '#64748b'}]} value={places[0].label} editable={false} />
           </View>
        ) : (
           <Dropdown label="સ્થળ પસંદ કરો" options={places} selectedValue={selectedPlaceId} onSelect={setSelectedPlaceId} placeholder="સ્થળ પસંદ કરો" />
        )}

        <Text style={[s.sectionTitle, {marginTop: 20}]}>2. જમણવાર અને મેનૂ</Text>
        {meals.map((meal, index) => (
          <View key={index} style={s.mealBox}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}><Text style={{fontWeight:'bold', color:'#1e3a8a', fontSize: 15}}>🗓️ {meal.date} • ⏰ {meal.time}</Text><Text style={{fontWeight:'bold', color:'#334155'}}>({meal.guestsCount} લોકો)</Text></View>
            <Text style={{fontWeight:'bold', marginTop: 5, color: '#1e293b'}}>{meal.mainType}</Text>
            <Text style={{color: '#64748b', fontSize: 13, marginTop: 2}}>{meal.items?.map((i:any)=>i.name).join(', ')}</Text>
            <View style={{flexDirection: 'row', gap: 10, marginTop: 12}}>
              <Pressable onPress={() => { setEditingMealIndex(index); setShowMealBuilder(true); }} style={[s.editBtn, {flex: 1, alignItems: 'center'}]}><Text style={s.editBtnText}>✏️ એડિટ</Text></Pressable>
              <Pressable onPress={() => setMeals(meals.filter((_, i) => i !== index))} style={[s.editBtn, {backgroundColor: '#fef2f2', borderColor: '#fca5a5', flex: 1, alignItems: 'center'}]}><Text style={[s.editBtnText, {color: '#dc2626'}]}>🗑️ કાઢી નાખો</Text></Pressable>
            </View>
          </View>
        ))}
        <Pressable onPress={() => { setEditingMealIndex(null); setShowMealBuilder(true); }} style={[s.primary, {backgroundColor:'#ffffff', borderWidth: 2, borderColor:'#047857', borderStyle:'dashed'}]}><Text style={{color:'#047857', fontWeight:'bold'}}>＋ નવો જમણવાર ઉમેરો</Text></Pressable>

        <Text style={[s.sectionTitle, {marginTop: 20}]}>3. અન્ય ફંડ અને પેમેન્ટ</Text>
        <Dropdown label="ઠાકોરજી સેવા (₹)" options={[{label:'₹ 0', value:'0'}, {label:'₹ 5100', value:'5100'}, {label:'₹ 11000', value:'11000'}]} selectedValue={thakorjiSeva} onSelect={setThakorjiSeva} />
        <TextInput placeholder="પહોંચ નંબર" style={s.input} value={receiptNo} onChangeText={setReceiptNo} />
        
        <View style={s.totalBox}>
          <Text style={s.grandTotal}>ફાઇનલ કુલ રકમ: ₹ {grandTotal.toLocaleString()}</Text>
          {initialData && diffTotal !== 0 && <Text style={{fontSize: 17, fontWeight: '900', color: diffTotal > 0 ? '#dc2626' : '#047857', marginTop: 8}}>{diffTotal > 0 ? `વધારાની રકમ: ₹${diffTotal}` : `પરત રકમ: ₹${Math.abs(diffTotal)}`}</Text>}
        </View>

        <Pressable disabled={saving} onPress={handleSaveBooking} style={[s.saveBtn, saving && {opacity:0.7}]}><Text style={s.saveBtnText}>{saving ? 'Saving...' : 'બુકિંગ ફાઇનલ સેવ કરો'}</Text></Pressable>
      </View>
      <MealBuilderModal visible={showMealBuilder} onClose={() => { setShowMealBuilder(false); setEditingMealIndex(null); }} menuItems={menuItems} onSave={saveMealData} initialData={editingMealIndex !== null ? meals[editingMealIndex] : null} />
    </View>
  );
}

// ================= PRODUCTION (રસોડું) MODULE (PLACE-WISE VIEW) =================
function ProductionHome() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [loading, setLoading] = useState(true);
  
  // Aggregated data by Place
  const [menuAggregates, setMenuAggregates] = useState<Record<string, Record<string, Record<string, Record<string, number>>>>>({});
  const [totalGuestsToday, setTotalGuestsToday] = useState(0);
  const [dispatchSchedule, setDispatchSchedule] = useState<any[]>([]);
  const [prodTab, setProdTab] = useState<'menu'|'dispatch'>('menu'); 

  const todayStr = getTodayStr();

  useEffect(() => { fetchProductionData(); }, []);

  async function fetchProductionData() {
    setLoading(true);
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('bookings').select('*');
      const { data: pData } = await supabase.from('places').select('*');
      if (error) throw error;
      if (data) {
        let agg: Record<string, Record<string, Record<string, Record<string, number>>>> = {};
        let tSchedule: any[] = []; let tGuests = 0;

        data.forEach(b => {
          let placeName = pData?.find((p:any) => p.id === b.place_id)?.name || 'અન્ય સ્થળ';
          if (!agg[placeName]) agg[placeName] = {};

          if (b.meals) {
            b.meals.forEach((m: any) => {
              if (m.date === todayStr) {
                const gCount = m.guestsCount || 0;
                tGuests += gCount;
                
                if (!agg[placeName][m.mainType]) agg[placeName][m.mainType] = {};
                m.items?.forEach((i: any) => {
                  const sub = i.sub_category || 'અન્ય';
                  if (!agg[placeName][m.mainType][sub]) agg[placeName][m.mainType][sub] = {};
                  if (!agg[placeName][m.mainType][sub][i.name]) agg[placeName][m.mainType][sub][i.name] = 0;
                  agg[placeName][m.mainType][sub][i.name] += gCount; 
                });

                tSchedule.push({
                  bookingId: b.id, hostName: `${b.name}`, mobile: b.mobile, time: m.time, timeValue: parseTimeForSort(m.time), placeName: placeName, mainType: m.mainType, guestsCount: gCount, items: m.items?.map((i:any)=>i.name) || [], note: m.note
                });
              }
            });
          }
        });
        tSchedule.sort((a, b) => a.timeValue - b.timeValue);
        setMenuAggregates(agg); setTotalGuestsToday(tGuests); setDispatchSchedule(tSchedule);
      }
    } catch (err: any) { Alert.alert('Error', err.message); } finally { setLoading(false); }
  }

  if (loading) return <LoadingScreen />;

  return (
    <View style={s.p18}>
      <View style={{flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: 15, gap: isMobile ? 12 : 0}}>
        <View><Text style={{fontSize: 26, fontWeight: '900', color: '#047857'}}>👨‍🍳 રસોડા વિભાગ (KDS)</Text><Text style={{color: '#64748b', fontSize: 14, fontWeight: 'bold', marginTop: 2}}>આજનું રસોઈ મેનૂ • {todayStr}</Text></View>
        <Pressable onPress={fetchProductionData} style={s.refreshBtn}><Text style={s.refreshBtnText}>🔄 રિફ્રેશ</Text></Pressable>
      </View>

      <View style={s.todayGuestsCard}>
         <Text style={{fontSize: 16, fontWeight: '900', color: '#065f46'}}>કુલ અંદાજિત જમણવાર (બધા સ્થળ મળીને): <Text style={{fontSize: 22}}>{totalGuestsToday} લોકો</Text></Text>
      </View>

      <View style={s.prodTabBar}>
         <Pressable onPress={()=>setProdTab('menu')} style={[s.prodTabBtn, prodTab==='menu' && s.prodTabBtnActive]}><Text style={[s.prodTabBtnText, prodTab==='menu' && s.prodTabBtnTextActive]}>👨‍🍳 સ્થળ મુજબ વાનગીઓ</Text></Pressable>
         <Pressable onPress={()=>setProdTab('dispatch')} style={[s.prodTabBtn, prodTab==='dispatch' && s.prodTabBtnActive]}><Text style={[s.prodTabBtnText, prodTab==='dispatch' && s.prodTabBtnTextActive]}>🚚 ડિસ્પેચ શિડ્યુલ</Text></Pressable>
      </View>

      {prodTab === 'menu' && (
        <View style={{gap: 20}}>
          {Object.keys(menuAggregates).length === 0 ? ( <Text style={s.muted}>આજે કોઈ મેનૂ બનાવવા માટે નથી.</Text> ) : (
            Object.keys(menuAggregates).map(place => (
              <View key={place} style={{backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 2, borderColor: '#047857', marginBottom: 15}}>
                <Text style={{fontSize: 22, fontWeight: '900', color: '#1e3a8a', backgroundColor: '#e0f2fe', padding: 10, borderRadius: 10, textAlign: 'center', marginBottom: 15}}>📍 {place}</Text>
                
                {Object.keys(menuAggregates[place]).map(type => (
                  <View key={type} style={{marginBottom: 15, padding: 12, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0'}}>
                    <Text style={{fontSize: 18, fontWeight: '900', color: '#047857', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 6, marginBottom: 8}}>{type}</Text>
                    {Object.keys(menuAggregates[place][type]).map(sub => (
                      <View key={sub} style={{marginBottom: 10}}>
                        <Text style={{fontSize: 14, fontWeight: 'bold', color: '#b91c1c', marginBottom: 6}}>{sub}</Text>
                        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12}}>
                          {Object.keys(menuAggregates[place][type][sub]).map(itemName => (
                            <View key={itemName} style={{backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', minWidth: '22%'}}><Text style={{fontSize: 14, fontWeight: 'bold', color: '#1e293b'}}>{itemName}</Text><Text style={{fontSize: 16, fontWeight: '900', color: '#d97706', marginTop: 2}}>{menuAggregates[place][type][sub][itemName]} <Text style={{fontSize: 12, color: '#64748b'}}>લોકો</Text></Text></View>
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
      )}

      {prodTab === 'dispatch' && (
        <View style={{backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20}}>
          {dispatchSchedule.length === 0 ? ( <Text style={s.muted}>આજે કોઈ ડિસ્પેચ ઓર્ડર નથી.</Text> ) : (
            <View style={{gap: 12}}>
              {dispatchSchedule.map((ds, idx) => (
                <View key={idx} style={s.timelineCard}>
                  <View style={s.timeBadge}><Text style={{color: '#854d0e', fontWeight: 'bold', fontSize: 15}}>⏰ {ds.time}</Text></View>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                    <View style={{flex: 1}}><Text style={{fontSize: 18, fontWeight: '900', color: '#1e293b'}}>📍 {ds.placeName}</Text><Text style={{fontSize: 15, fontWeight: 'bold', color: '#047857', marginTop: 3}}>{ds.mainType} • {ds.guestsCount} લોકો</Text><View style={{marginTop: 8, padding: 8, backgroundColor: '#f1f5f9', borderRadius: 6}}><Text style={{color: '#334155', fontSize: 13}}>🍽️ {ds.items?.join(', ')}</Text></View></View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ================= UTILITY COMPONENTS (Complete without truncating) =================
function DispatchHome() { return <View style={s.p18}><Text style={s.h1}>Dispatch Dashboard</Text></View>; }
function Card({ title, icon, value }: any) { return <View style={s.card}><Text style={s.icon}>{icon}</Text><Text style={s.muted}>{title}</Text><Text style={s.value}>{value}</Text></View>; }
function LoadingScreen() { return <SafeAreaView style={s.center}><ActivityIndicator size="large" color="#047857" /><Text style={{marginTop:10, color: '#64748b'}}>Loading...</Text></SafeAreaView>; }
function SetupScreen() { return <SafeAreaView style={s.center}><Text style={{color: '#dc2626'}}>Supabase config missing.</Text></SafeAreaView>; }

function BookingCard({ b, places, isAdmin, onEdit, onDelete }: any) {
  const placeName = places.find((p:any) => p.id === b.place_id)?.name || 'સ્થળ નથી';
  
  function sendWhatsAppMessage() {
    if (!b.mobile || b.mobile.length !== 10) {
      Alert.alert('ભૂલ', 'WhatsApp મેસેજ મોકલવા માટે 10 આંકડાનો સાચો મોબાઈલ નંબર હોવો જરૂરી છે.');
      return;
    }
    
    let mealDetails = '';
    if (b.meals && b.meals.length > 0) {
      b.meals.forEach((m: any, idx: number) => {
        const itemsList = m.items?.map((i:any)=> i.name ? i.name : i).join(', ') || '';
        mealDetails += `\n*${idx + 1}. ${m.mainType} (${m.guestsCount} લોકો)*\n🗓️ તારીખ: ${m.date} | ⏰ સમય: ${m.time}\n📍 સ્થળ: ${placeName}\n🍽️ વાનગીઓ: ${itemsList}\n`;
        if (m.note) mealDetails += `📝 નોંધ: ${m.note}\n`;
      });
    }

    const message = `જય સ્વામિનારાયણ! 🙏\nBAPS રાજકોટ (રસોઈ સેવા વિભાગ) તરફથી આપનું બુકિંગ કન્ફર્મ થઈ ગયું છે.\n\n*યજમાન:* ${b.name} ${b.surname}\n*મોબાઈલ:* ${b.mobile}\n${b.receipt_no ? `*પહોંચ નંબર:* ${b.receipt_no}\n` : ''}\n*જમણવારની વિગત:*${mealDetails}\n*રકમની વિગત:*\n💰 કુલ રકમ: ₹${b.grand_total}\n✅ સ્ટેટસ: ${b.payment_status === 'Full' ? 'ફૂલ પેમેન્ટ' : 'પેન્ડિંગ (Partial)'}\n\nઆભાર!`;

    const url = `https://wa.me/91${b.mobile}?text=${encodeURIComponent(message)}`;
    
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'WhatsApp ઓપન કરવામાં ભૂલ આવી.');
      });
    }
  }

  return (
    <View style={s.bookingCard}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10, marginBottom: 10}}>
        <View style={{flex: 1}}>
          <Text style={{fontWeight:'900', fontSize: 18, color: '#1e293b'}}>{b.name} {b.surname}</Text>
          {b.mobile ? (
            <Pressable onPress={() => Linking.openURL(`tel:${b.mobile}`)} style={{marginTop: 4}}>
              <Text style={{color: '#0284c7', fontWeight: 'bold', fontSize: 14, textDecorationLine: 'underline'}}>📞 {b.mobile} (કૉલ કરો)</Text>
            </Pressable>
          ) : ( <Text style={{color: '#94a3b8', fontSize: 14, marginTop: 4}}>📞 નંબર નથી</Text> )}
        </View>
        <View style={{alignItems: 'flex-end'}}>
          <Text style={s.statusBadgeText}>{b.payment_status}</Text>
          <Text style={{color: '#64748b', fontSize: 12, marginTop: 6, fontWeight: 'bold'}}>પહોંચ: {b.receipt_no || '-'}</Text>
        </View>
      </View>

      {b.meals?.map((m: any, idx: number) => (
        <View key={idx} style={s.mealBox}>
          <Text style={{fontWeight: 'bold', color: '#1e3a8a', fontSize: 14}}>🗓️ {m.date} • ⏰ {m.time}</Text>
          <Text style={{fontWeight: '700', marginTop: 4, color: '#334155'}}>📍 {placeName} • {m.mainType} ({m.guestsCount} લોકો)</Text>
          <Text style={{color: '#64748b', fontSize: 13, marginTop: 2}}>🍽️ {m.items?.map((i:any)=> i.name ? i.name : i).join(', ')}</Text>
          {m.note ? <Text style={{color: '#d97706', fontSize: 13, fontWeight: 'bold', marginTop: 4}}>📝 નોંધ: {m.note}</Text> : null}
        </View>
      ))}

      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12}}>
        <Text style={{color:'#d97706', fontWeight:'900', fontSize: 17}}>{isAdmin ? `💰 કુલ: ₹${b.grand_total?.toLocaleString()}` : ''}</Text>
        <View style={{flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end'}}>
          <Pressable onPress={sendWhatsAppMessage} style={[s.editBtn, {backgroundColor: '#f0fdf4', borderColor: '#86efac'}]}>
             <Text style={{color:'#047857', fontWeight: 'bold'}}>💬 WhatsApp</Text>
          </Pressable>
          <Pressable onPress={() => onEdit(b)} style={s.editBtn}><Text style={s.editBtnText}>✏️ એડિટ</Text></Pressable>
          <Pressable onPress={() => onDelete(b.id)} style={[s.editBtn, {backgroundColor: '#fef2f2', borderColor: '#fca5a5'}]}><Text style={{color:'#dc2626', fontWeight: 'bold'}}>🗑️ ડિલીટ</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

function Dropdown({ label, options, selectedValue, onSelect, placeholder, onAddNew }: any) {
  const [visible, setVisible] = useState(false);
  const selected = options.find((o: any) => o.value === selectedValue);
  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={s.label}>{label}</Text>}
      <Pressable onPress={() => setVisible(true)} style={s.input}><Text style={{ color: selected ? '#1e293b' : '#9ca3af', fontSize: 16 }}>{selected ? selected.label : placeholder || 'પસંદ કરો'}</Text></Pressable>
      <Modal visible={visible} transparent animationType="slide">
        <View style={s.modalBg}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>{label || 'પસંદ કરો'}</Text>
            <ScrollView>
               {options.map((o: any) => (<Pressable key={o.value} style={s.modalItem} onPress={() => { onSelect(o.value); setVisible(false); }}><Text style={[s.modalItemText, selectedValue === o.value ? { color: '#047857', fontWeight: 'bold' } : null]}>{o.label}</Text></Pressable>))}
               {onAddNew && (
                  <Pressable style={s.modalItem} onPress={() => { setVisible(false); onAddNew(); }}>
                     <Text style={{color: '#047857', fontWeight: '900'}}>＋ નવો પ્રકાર ઉમેરો</Text>
                  </Pressable>
               )}
            </ScrollView>
            <Pressable onPress={() => setVisible(false)} style={s.closeButton}><Text style={s.closeText}>બંધ કરો</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DatePickerModal({ label, selectedDate, onSelect, placeholder }: any) {
  const [visible, setVisible] = useState(false);
  const [day, setDay] = useState(new Date().getDate());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (visible && selectedDate) {
      const [d, m, y] = selectedDate.split('-');
      if (d && m && y) { setDay(parseInt(d)); setMonth(parseInt(m)); setYear(parseInt(y)); }
    }
  }, [visible]);

  function handleSave() { onSelect(`${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${year}`); setVisible(false); }

  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={s.label}>{label}</Text>}
      <Pressable onPress={() => setVisible(true)} style={[s.input, { marginBottom: 0 }]}><Text style={{ color: selectedDate ? '#1e293b' : '#9ca3af', fontSize: 16 }}>{selectedDate || placeholder}</Text></Pressable>
      <Modal visible={visible} transparent animationType="fade">
        <View style={s.modalBg}>
          <View style={[s.modalContent, {alignItems: 'center'}]}>
            <Text style={s.modalTitle}>તારીખ પસંદ કરો</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 15, marginVertical: 20}}>
              <View style={{alignItems: 'center'}}><Pressable onPress={()=>setDay(d=>d>=31?1:d+1)} style={s.arrowBtn}><Text style={s.arrowText}>▲</Text></Pressable><Text style={s.timeText}>{day.toString().padStart(2, '0')}</Text><Pressable onPress={()=>setDay(d=>d<=1?31:d-1)} style={s.arrowBtn}><Text style={s.arrowText}>▼</Text></Pressable></View>
              <Text style={s.timeText}>/</Text>
              <View style={{alignItems: 'center'}}><Pressable onPress={()=>setMonth(m=>m>=12?1:m+1)} style={s.arrowBtn}><Text style={s.arrowText}>▲</Text></Pressable><Text style={s.timeText}>{month.toString().padStart(2, '0')}</Text><Pressable onPress={()=>setMonth(m=>m<=1?12:m-1)} style={s.arrowBtn}><Text style={s.arrowText}>▼</Text></Pressable></View>
              <Text style={s.timeText}>/</Text>
              <View style={{alignItems: 'center'}}><Pressable onPress={()=>setYear(y=>y+1)} style={s.arrowBtn}><Text style={s.arrowText}>▲</Text></Pressable><Text style={[s.timeText, {width: 80}]}>{year}</Text><Pressable onPress={()=>setYear(y=>y-1)} style={s.arrowBtn}><Text style={s.arrowText}>▼</Text></Pressable></View>
            </View>
            <Pressable onPress={handleSave} style={[s.primary, {width: '100%'}]}><Text style={s.primaryText}>તારીખ સેવ કરો</Text></Pressable>
            <Pressable onPress={() => setVisible(false)} style={[s.closeButton, {width: '100%'}]}><Text style={s.closeText}>બંધ કરો</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function AlarmTimePicker({ label, selectedTime, onSelect, placeholder }: any) {
  const [visible, setVisible] = useState(false);
  const [hour, setHour] = useState(10);
  const [minute, setMinute] = useState(30);
  const [ampm, setAmpm] = useState('AM');

  useEffect(() => {
    if (visible && selectedTime) {
      const [hm, a] = selectedTime.split(' ');
      const [h, m] = hm.split(':');
      if (h && m && a) { setHour(parseInt(h)); setMinute(parseInt(m)); setAmpm(a); }
    }
  }, [visible]);

  function handleSave() { onSelect(`${hour}:${minute.toString().padStart(2, '0')} ${ampm}`); setVisible(false); }

  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={s.label}>{label}</Text>}
      <Pressable onPress={() => setVisible(true)} style={[s.input, { marginBottom: 0 }]}><Text style={{ color: selectedTime ? '#1e293b' : '#9ca3af', fontSize: 16 }}>{selectedTime || placeholder}</Text></Pressable>
      <Modal visible={visible} transparent animationType="fade">
        <View style={s.modalBg}>
          <View style={[s.modalContent, {alignItems: 'center'}]}>
            <Text style={s.modalTitle}>સમય સેટ કરો</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 20, marginVertical: 20}}>
              <View style={{alignItems: 'center'}}><Pressable onPress={()=>setHour(h=>h===12?1:h+1)} style={s.arrowBtn}><Text style={s.arrowText}>▲</Text></Pressable><Text style={s.timeText}>{hour}</Text><Pressable onPress={()=>setHour(h=>h===1?12:h-1)} style={s.arrowBtn}><Text style={s.arrowText}>▼</Text></Pressable></View>
              <Text style={s.timeText}>:</Text>
              <View style={{alignItems: 'center'}}><Pressable onPress={()=>setMinute(m=>m>=55?0:m+5)} style={s.arrowBtn}><Text style={s.arrowText}>▲</Text></Pressable><Text style={s.timeText}>{minute.toString().padStart(2, '0')}</Text><Pressable onPress={()=>setMinute(m=>m<=0?55:m-5)} style={s.arrowBtn}><Text style={s.arrowText}>▼</Text></Pressable></View>
              <Pressable onPress={()=>setAmpm(a=>a==='AM'?'PM':'AM')} style={s.ampmBtn}><Text style={s.ampmText}>{ampm}</Text></Pressable>
            </View>
            <Pressable onPress={handleSave} style={[s.primary, {width: '100%'}]}><Text style={s.primaryText}>સમય સેવ કરો</Text></Pressable>
            <Pressable onPress={() => setVisible(false)} style={[s.closeButton, {width: '100%'}]}><Text style={s.closeText}>બંધ કરો</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MealBuilderModal({ visible, onClose, onSave, menuItems, initialData }: any) {
  const [date, setDate] = useState(''); const [time, setTime] = useState(''); const [guestsCount, setGuestsCount] = useState(''); 
  const [mainType, setMainType] = useState('લંચ'); const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [calculatedTotal, setCalculatedTotal] = useState<number | null>(null); const [mealNote, setMealNote] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visible) {
      setSearchQuery(''); setExpandedSubs({});
      if (initialData) {
        setDate(initialData.date); setTime(initialData.time); setGuestsCount(initialData.guestsCount.toString());
        setMainType(initialData.mainType); setMealNote(initialData.note || ''); setCalculatedTotal(initialData.ratePerPlate);
        const itemsMap: any = {}; initialData.items.forEach((i:any) => itemsMap[i.id] = true); setSelectedItems(itemsMap);
      } else {
        setDate(''); setTime(''); setGuestsCount(''); setMainType('લંચ'); setSelectedItems({}); setCalculatedTotal(null); setMealNote('');
      }
    }
  }, [visible, initialData]);

  if (!visible) return null;

  const toggleItem = (id: string) => setSelectedItems(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleSub = (sub: string) => setExpandedSubs(prev => ({...prev, [sub]: !prev[sub]}));

  const filteredMenu = menuItems.filter((m:any) => m.is_active && m.main_type === mainType && m.name.toLowerCase().includes(searchQuery.toLowerCase()));

  function calculatePrice() {
    let total = 0;
    menuItems.forEach((item:any) => { if (selectedItems[item.id]) total += item.price; });
    setCalculatedTotal(total);
  }

  function handleSave() {
    if (!date || !time || !guestsCount) return Alert.alert('Error', 'તારીખ, સમય અને લોકોની સંખ્યા લખવી જરૂરી છે');
    if (calculatedTotal === null) return Alert.alert('Error', 'પહેલા મેનૂનો ભાવ ગણો');
    const itemsList = menuItems.filter((m:any) => selectedItems[m.id]);
    onSave({ date, time, guestsCount: parseInt(guestsCount) || 0, mainType, items: itemsList, ratePerPlate: calculatedTotal, note: mealNote });
    onClose();
  }

  // Find dynamic subcategories available for this mainType
  const availableSubs = Array.from(new Set(menuItems.filter((m:any)=>m.main_type === mainType).map((m:any)=>m.sub_category).filter(Boolean)));

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={{flex:1, backgroundColor:'#f8fafc'}}>
        <View style={[s.header, {paddingTop: Platform.OS === 'web' ? 20 : 0}]}><Text style={s.h1}>{initialData ? 'જમણવાર એડિટ કરો' : 'નવો જમણવાર ઉમેરો'}</Text><Pressable onPress={onClose}><Text style={{fontSize:24, color: '#64748b'}}>✕</Text></Pressable></View>
        <ScrollView contentContainerStyle={[s.webContainer, s.p18]}>
          <View style={s.formCard}>
            <DatePickerModal label="તારીખ પસંદ કરો" selectedDate={date} onSelect={setDate} placeholder="તારીખ પસંદ કરવા અહી ક્લિક કરો" />
            <AlarmTimePicker label="જમવાનો સમય" selectedTime={time} onSelect={setTime} placeholder="સમય સેટ કરવા અહી ક્લિક કરો" />
            <Text style={s.label}>આ જમણવાર માટે લોકોની સંખ્યા</Text>
            <TextInput placeholder="દા.ત. 150" placeholderTextColor="#9ca3af" style={s.input} keyboardType="numeric" value={guestsCount} onChangeText={setGuestsCount} />
            <Dropdown label="જમવાનો પ્રકાર" options={Array.from(new Set(menuItems.map(m=>m.main_type))).map(t => ({label: t, value: t}))} selectedValue={mainType} onSelect={setMainType} />
            
            <Text style={[s.sectionTitle, {marginTop: 15}]}>મેનૂ પસંદગી</Text>
            <TextInput style={[s.input, {borderColor: '#047857', borderWidth: 2}]} placeholder="🔍 અહીં વાનગીનું નામ શોધો..." placeholderTextColor="#9ca3af" value={searchQuery} onChangeText={setSearchQuery} />

            {availableSubs.map((sub: any) => {
              const items = filteredMenu.filter((m:any) => m.sub_category === sub);
              if (items.length === 0) return null;
              const isExpanded = expandedSubs[sub] || searchQuery.length > 0;
              return (
                <View key={sub} style={{marginBottom: 10}}>
                  <Pressable onPress={() => toggleSub(sub)} style={s.collapsibleHeader}>
                     <Text style={s.collapsibleHeaderText}>{sub} ({items.length})</Text>
                     <Text style={s.collapsibleHeaderIcon}>{isExpanded ? '▲' : '▼'}</Text>
                  </Pressable>
                  {isExpanded && (
                    <View style={[s.chipContainer, {paddingTop: 10}]}>
                      {items.map((item:any) => (
                        <Pressable key={item.id} style={[s.chip, selectedItems[item.id] && s.chipSelected]} onPress={() => toggleItem(item.id)}>
                          <Text style={[s.chipText, selectedItems[item.id] && s.chipTextSelected]}>{item.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              )
            })}

            <Text style={[s.label, {marginTop: 10}]}>આ જમણવાર માટે ખાસ નોંધ</Text>
            <TextInput placeholder="દા.ત. જમવામાં તીખું ઓછું રાખવું..." placeholderTextColor="#9ca3af" style={[s.input, {height: 70, textAlignVertical: 'top'}]} multiline value={mealNote} onChangeText={setMealNote} />

            <Pressable onPress={calculatePrice} style={[s.primary, {backgroundColor:'#0284c7', marginTop: 20}]}><Text style={s.primaryText}>મેનૂનો ભાવ ગણો</Text></Pressable>
            {calculatedTotal !== null && <View style={s.autoRateBox}><Text style={s.autoRateLabel}>૧ ડિશનો ફિક્સ ભાવ:</Text><Text style={s.autoRateValue}>₹ {calculatedTotal}</Text></View>}
            <Pressable onPress={handleSave} style={[s.saveBtn, {marginTop: 20}]}><Text style={s.saveBtnText}>{initialData ? 'ફેરફાર સેવ કરો' : 'આ જમણવાર સેવ કરો'}</Text></Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#f8fafc'}, webContainer: { maxWidth: 1200, width: '100%', alignSelf: 'center' }, p18: { padding: 18 }, 
  loginSafe:{flex:1,backgroundColor:'#f8fafc',justifyContent:'center',padding:20}, center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#f8fafc'}, 
  loginCard:{backgroundColor:'#ffffff',borderRadius:20,padding:30,shadowColor:'#000',shadowOffset:{width:0,height:4},shadowOpacity:0.08,shadowRadius:12,elevation:4, borderWidth: 1, borderColor: '#e2e8f0'}, 
  loginTitle:{fontSize:24,fontWeight:'900',textAlign:'center',color:'#047857'}, loginSub:{textAlign:'center',color:'#64748b',marginBottom:24,marginTop:6,fontSize:14, fontWeight: '600'}, 
  header:{paddingHorizontal:20,paddingVertical:16,backgroundColor:'#ffffff',flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#e2e8f0', shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.03, elevation:2}, 
  headerText:{flex:1,marginRight:10}, appTitle:{fontSize:18,fontWeight:'900',color:'#1e293b'}, role:{fontSize:13,color:'#64748b',marginTop:2, fontWeight: '600'}, 
  logout:{paddingVertical:8,paddingHorizontal:12,borderRadius:8,backgroundColor:'#fef2f2', borderWidth: 1, borderColor: '#fca5a5'}, 
  h1:{fontSize:26,fontWeight:'900',marginBottom:10, color:'#1e293b'}, muted:{color:'#64748b',lineHeight:20, fontSize: 14}, 
  grid:{flexDirection:'row',flexWrap:'wrap',gap:12,marginVertical:15}, card:{backgroundColor:'#ffffff',borderRadius:16,padding:18,width:'48%',minHeight:110,borderWidth:1,borderColor:'#e2e8f0', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.04, shadowRadius:8, elevation:2}, 
  icon:{fontSize:28}, value:{fontSize:26,fontWeight:'900',marginTop:6, color: '#1e293b'}, 
  todayGuestsCard: { backgroundColor: '#f0fdf4', borderRadius: 16, padding: 18, borderWidth: 1.5, borderColor: '#6ee7b7', marginVertical: 10, shadowColor: '#047857', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  mealPill: { backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#a7f3d0' },
  input:{backgroundColor:'#ffffff',borderWidth:1,borderColor:'#cbd5e1',borderRadius:10,padding:14,marginBottom:14,fontSize:16, color: '#1e293b'}, label:{fontWeight:'700',marginBottom:6, marginTop:4, color: '#334155', fontSize: 14}, 
  primary:{backgroundColor:'#047857',padding:16,borderRadius:12,alignItems:'center',marginVertical:6, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.1, elevation:2}, primaryText:{color:'#fff',fontSize:16,fontWeight:'800'}, 
  backButton:{alignSelf:'flex-start',paddingVertical:6,paddingHorizontal:2,marginBottom:10}, backText:{fontSize:15,fontWeight:'700',color:'#047857'}, 
  formCard:{backgroundColor:'#ffffff',borderRadius:16,padding:20,marginTop:12,borderWidth:1,borderColor:'#e2e8f0', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.04, elevation:2}, sectionTitle:{fontSize:18,fontWeight:'900',marginBottom:14, color: '#1e293b'}, 
  menuBtn: { backgroundColor: '#ffffff', padding: 18, borderRadius: 12, alignItems: 'center', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.05, elevation:2, borderWidth: 1, borderColor: '#e2e8f0' }, menuBtnText: { color: '#1e293b', fontSize: 16, fontWeight: 'bold' }, 
  listCard: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, backgroundColor:'#ffffff', marginBottom:10, borderRadius:12, borderWidth:1, borderColor:'#e2e8f0', shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.02, elevation:1 }, 
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }, editBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff' }, editBtnText: { fontWeight: 'bold', color: '#475569', fontSize: 13 }, 
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }, modalContent: { backgroundColor: '#ffffff', borderRadius: 20, padding: 22, margin: 20, maxHeight: '80%', borderWidth: 1, borderColor: '#e2e8f0' }, 
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 15, color: '#1e293b' }, modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }, modalItemText: { fontSize: 16, color: '#334155' }, 
  closeButton: { marginTop: 12, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 10, alignItems: 'center' }, closeText: { fontWeight: 'bold', color: '#475569' }, 
  refreshBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#f1f5f9', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' }, refreshBtnText: { fontSize: 14, color: '#1e3a8a', fontWeight: 'bold' },
  prodTabBar: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 15 },
  prodTabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  prodTabBtnActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, elevation: 1 },
  prodTabBtnText: { fontWeight: 'bold', color: '#64748b' },
  prodTabBtnTextActive: { color: '#047857', fontWeight: '900' },
  timelineCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 5, borderLeftColor: '#d97706', shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.02, elevation:1 },
  timeBadge: { backgroundColor: '#fefce8', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#fde047', alignSelf: 'flex-start', marginBottom: 8 },
  bookingCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.04, elevation:2 },
  mealBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  statusBadgeText: { backgroundColor: '#f0fdf4', color: '#047857', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontWeight: 'bold', fontSize: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#bbf7d0' },
  totalBox: { backgroundColor: '#fefce8', padding: 16, borderRadius: 12, marginTop: 15, alignItems: 'flex-end', borderWidth: 1, borderColor: '#fde047' }, grandTotal: { fontSize: 22, fontWeight: '900', color: '#854d0e' }, saveBtn: { backgroundColor: '#d97706', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.1, elevation:2 }, saveBtnText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  arrowBtn: { padding: 10, backgroundColor: '#f1f5f9', borderRadius: 10 }, arrowText: { fontSize: 20, color: '#475569' }, timeText: { fontSize: 28, fontWeight: 'bold', marginVertical: 10, width: 50, textAlign: 'center', color: '#1e293b' }, ampmBtn: { backgroundColor: '#047857', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 10, marginLeft: 10 }, ampmText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  mainTypeHeader: { fontSize: 20, fontWeight: '900', color: '#047857', borderBottomWidth: 2, borderBottomColor: '#047857', paddingBottom: 6, marginBottom: 12, marginTop: 10 }, collapsibleHeader: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }, collapsibleHeaderText: { fontSize: 16, fontWeight: 'bold', color: '#1e3a8a' }, collapsibleHeaderIcon: { fontSize: 14, color: '#1e3a8a', fontWeight: 'bold' }, chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 4, marginBottom: 15 }, chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 25, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff' }, chipSelected: { backgroundColor: '#047857', borderColor: '#047857' }, chipText: { fontSize: 14, color: '#475569', fontWeight: '600' }, chipTextSelected: { color: '#ffffff' }, autoRateBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f0fdf4', borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0', marginTop: 15 }, autoRateLabel: { fontSize: 16, fontWeight: 'bold', color: '#166534' }, autoRateValue: { fontSize: 20, fontWeight: '900', color: '#047857' }
});

