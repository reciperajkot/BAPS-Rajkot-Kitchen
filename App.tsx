import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, Platform, Linking, Image, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';

type Role = 'admin' | 'counter' | 'production' | 'dispatch' | 'super_admin';
type Profile = { id: string; full_name: string | null; mobile: string | null; role: Role; is_active: boolean; duty_places?: string[]; photo_url?: string; login_email?: string; login_pass?: string };

const roleLabel: Record<Role, string> = { admin: 'Admin', super_admin: 'Super Admin', counter: 'Cash Counter', production: 'Production (રસોડું)', dispatch: 'Dispatch' };

// Fallback Types
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
          <Pressable disabled={submitting} onPress={signIn} style={s.primary}><Text style={s.primaryText}>{submitting ? 'લૉગ ઇન થઈ રહ્યું છે…' : 'Login'}</Text></Pressable>
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
  const [activeTab, setActiveTab] = useState<'home'|'menu'|'places'|'users'|'bookings'|'today'|'settings'>('home');
  const [stats, setStats] = useState({ count: 0, revenue: 0 });
  const [todayData, setTodayData] = useState({ total: 0, mealMap: {} as any });
  const [tomorrowData, setTomorrowData] = useState({ total: 0, mealMap: {} as any });
  const [refreshing, setRefreshing] = useState(false); const [showRevenue, setShowRevenue] = useState(false);
  const { sortedMains } = useSortedCategories();

  useEffect(() => { if(activeTab === 'home') fetchDashboard(); }, [activeTab]);

  async function fetchDashboard() {
    if (!supabase) return; setRefreshing(true);
    try {
      const { data, error } = await supabase.from('bookings').select('*');
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
    } catch (err: any) { showMsg('Error', err.message); } finally { setRefreshing(false); }
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

// ================= ADMIN MENU SCREEN (DRAG & DROP SORTING) =================
function AdminMenuScreen({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState(''); const [mainType, setMainType] = useState(''); const [subCategory, setSubCategory] = useState(''); const [price, setPrice] = useState(''); 
  const [menuItems, setMenuItems] = useState<any[]>([]); const [editingId, setEditingId] = useState<string | null>(null);
  
  const [dynamicMainTypes, setDynamicMainTypes] = useState<string[]>([]); 
  const [dynamicSubTypes, setDynamicSubTypes] = useState<string[]>([]);
  
  const [searchQuery, setSearchQuery] = useState(''); const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});
  const [showCatManager, setShowCatManager] = useState(false); const [savingSort, setSavingSort] = useState(false);

  // Drag State for Web
  const [draggedMainIdx, setDraggedMainIdx] = useState<number | null>(null);
  const [draggedSubIdx, setDraggedSubIdx] = useState<number | null>(null);

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
    
    // Auto-fix 99 bug: Assign correct current max order if not found
    const finalMSort = mainSortVal > -1 ? mainSortVal : dynamicMainTypes.length;
    const finalSSort = subSortVal > -1 ? subSortVal : dynamicSubTypes.length;

    const payload = { name: name.trim(), main_type: mainType, sub_category: subCategory, price: parseFloat(price) || 0, is_active: true, main_sort: finalMSort, sub_sort: finalSSort };
    try {
      if (editingId) await supabase.from('menu_items').update(payload).eq('id', editingId);
      else await supabase.from('menu_items').insert([payload]);
      setName(''); setPrice(''); setEditingId(null); fetchMenu(); showMsg('Success', 'વાનગી સફળતાપૂર્વક સેવ થઈ ગઈ!');
    } catch (err: any) { showMsg('Error', err.message); }
  }

  // --- HTML5 Drag & Drop Logic for Web ---
  const handleMainDrop = (dropIdx: number) => {
    if (draggedMainIdx === null || draggedMainIdx === dropIdx) return;
    const newList = [...dynamicMainTypes];
    const [removed] = newList.splice(draggedMainIdx, 1);
    newList.splice(dropIdx, 0, removed);
    setDynamicMainTypes(newList);
    setDraggedMainIdx(null);
  };

  const handleSubDrop = (dropIdx: number) => {
    if (draggedSubIdx === null || draggedSubIdx === dropIdx) return;
    const newList = [...dynamicSubTypes];
    const [removed] = newList.splice(draggedSubIdx, 1);
    newList.splice(dropIdx, 0, removed);
    setDynamicSubTypes(newList);
    setDraggedSubIdx(null);
  };

  // The Magic Save Button Logic
  async function saveGlobalSortOrder() {
    if(!supabase) return;
    setSavingSort(true);
    try {
      const updates: Promise<any>[] = [];
      // Update all main types across the entire menu table
      dynamicMainTypes.forEach((catName, idx) => {
        updates.push(supabase!.from('menu_items').update({ main_sort: idx }).eq('main_type', catName));
      });
      // Update all sub categories
      dynamicSubTypes.forEach((catName, idx) => {
        updates.push(supabase!.from('menu_items').update({ sub_sort: idx }).eq('sub_category', catName));
      });
      
      await Promise.all(updates);
      await fetchMenu();
      setSavingSort(false);
      setShowCatManager(false);
      showMsg('સફળતા 🎉', 'ક્રમ ડેટાબેઝમાં કાયમી સેવ થઈ ગયો છે અને આખી એપમાં અપડેટ થઈ ગયો છે!');
    } catch (e: any) { setSavingSort(false); showMsg('Error', e.message); }
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
                  <Pressable onPress={() => setExpandedSubs(p=>({...p, [`${type}_${sub}`]:!p[`${type}_${sub}`]}))} style={s.collapsibleHeader}>
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

      {/* DRAG AND DROP MODAL */}
      <Modal visible={showCatManager} animationType="slide">
        <SafeAreaView style={s.safe}>
           <View style={[s.header, {paddingTop: Platform.OS==='web'?20:0}]}><Text style={s.h1}>કેટેગરીનો ક્રમ બદલો</Text><Pressable onPress={()=>setShowCatManager(false)}><Text style={{fontSize:24, color:'#64748b'}}>✕</Text></Pressable></View>
           <ScrollView contentContainerStyle={[s.webContainer, s.p18]}>
              <View style={s.formCard}>
                <Text style={s.sectionTitle}>જમણવાર ના પ્રકાર (માઉસથી પકડીને ઉપર-નીચે ખેંચો)</Text>
                {dynamicMainTypes.map((t, idx) => (
                  <View 
                     key={t} 
                     style={[s.dragItem, draggedMainIdx === idx && s.dragging]}
                     //@ts-ignore (HTML5 native drag for web)
                     draggable={Platform.OS === 'web'}
                     onDragStart={() => setDraggedMainIdx(idx)}
                     onDragOver={(e: any) => { if (Platform.OS === 'web') e.preventDefault(); }}
                     onDrop={() => handleMainDrop(idx)}
                  >
                    <Text style={s.dragHandle}>☰</Text>
                    <Text style={{fontSize:16, fontWeight:'bold', color:'#1e293b', flex: 1}}>{idx + 1}. {t}</Text>
                  </View>
                ))}
              </View>

              <View style={[s.formCard, {marginTop: 20}]}>
                <Text style={s.sectionTitle}>વાનગી ના પ્રકાર (માઉસથી પકડીને ઉપર-નીચે ખેંચો)</Text>
                {dynamicSubTypes.map((t, idx) => (
                  <View 
                     key={t} 
                     style={[s.dragItem, draggedSubIdx === idx && s.dragging]}
                     //@ts-ignore 
                     draggable={Platform.OS === 'web'}
                     onDragStart={() => setDraggedSubIdx(idx)}
                     onDragOver={(e: any) => { if (Platform.OS === 'web') e.preventDefault(); }}
                     onDrop={() => handleSubDrop(idx)}
                  >
                    <Text style={s.dragHandle}>☰</Text>
                    <Text style={{fontSize:16, fontWeight:'bold', color:'#1e293b', flex: 1}}>{idx + 1}. {t}</Text>
                  </View>
                ))}
              </View>

              {/* MAGIC SAVE BUTTON */}
              <Pressable disabled={savingSort} onPress={saveGlobalSortOrder} style={[s.saveBtn, {marginTop: 30, paddingVertical: 20}]}>
                 <Text style={{color: '#fff', fontSize: 18, fontWeight: '900'}}>{savingSort ? 'સેવ થઈ રહ્યું છે...' : '💾 ફાઇનલ ક્રમ સેવ કરો (Global Update)'}</Text>
              </Pressable>
              
              <Text style={{textAlign: 'center', marginTop: 15, color: '#64748b', fontSize: 14}}>નોંધ: સેવ કર્યા પછી આખી એપમાં (ડેશબોર્ડ, કાઉન્ટર, રસોડું) ક્રમ આપોઆપ બદલાઈ જશે.</Text>
           </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ================= ADMIN PLACES & USERS =================
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
  const [users, setUsers] = useState<any[]>([]); const [places, setPlaces] = useState<any[]>([]); const [showForm, setShowForm] = useState(false); const [editingId, setEditingId] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const [name, setName] = useState(''); const [role, setRole] = useState<Role>('counter'); const [selectedDutyPlaces, setSelectedDutyPlaces] = useState<string[]>([]); const [loginEmail, setLoginEmail] = useState(''); const [loginPass, setLoginPass] = useState('');
  useEffect(() => { fetchData(); }, []);
  async function fetchData() { 
    if (!supabase) return; 
    const { data: uData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }); const { data: pData } = await supabase.from('places').select('*').eq('is_active', true);
    if (uData) setUsers(uData.map(u => ({...u, duty_places: Array.isArray(u.duty_places) ? u.duty_places : (typeof u.duty_places === 'string' ? JSON.parse(u.duty_places||'[]') : [u.duty_place])})));
    if (pData) setPlaces(pData);
  }
  async function saveUser() {
    if (!name || !loginEmail || (!loginPass && !editingId)) return showMsg('ભૂલ ❌', 'નામ, યુઝર ID અને પાસવર્ડ ફરજિયાત છે.');
    if (!supabase) return; setSaving(true);
    const authEmail = loginEmail.includes('@') ? loginEmail.toLowerCase() : `${loginEmail.toLowerCase()}@baps.local`;
    const payload: any = { full_name: name, role, duty_places: selectedDutyPlaces, login_email: loginEmail, is_active: true };
    if (editingId) {
      if (loginPass) payload.login_pass = loginPass;
      await supabase.from('profiles').update(payload).eq('id', editingId); setSaving(false); showMsg('સફળતા 🎉', 'યુઝર અપડેટ થઈ ગયો!'); setShowForm(false); setEditingId(null); fetchData(); 
    } else {
      try {
        const { data } = await supabase.auth.getSession(); const token = data?.session?.access_token;
        const res = await fetch('https://ooeecqioprwverlpdjqe.supabase.co/functions/v1/create-auth-user', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ email: authEmail, password: loginPass, full_name: name, role }) });
        const result = await res.json(); if (!res.ok) throw new Error(result.error);
        await supabase.from('profiles').update({ duty_places: selectedDutyPlaces, login_email: loginEmail }).eq('id', result.user.id);
        setSaving(false); showMsg('સફળતા 🎉', 'નવો યુઝર બની ગયો!'); setShowForm(false); setEditingId(null); fetchData();
      } catch (err: any) { setSaving(false); showMsg('ભૂલ ❌', err.message); }
    }
  }
  return (
    <View style={s.p18}>
      <Pressable onPress={onBack} style={s.backButton}><Text style={s.backText}>‹ પાછા સેટિંગ્સ પર</Text></Pressable>
      <Text style={s.h1}>યુઝર મેનેજમેન્ટ</Text>
      {showForm ? (
        <View style={s.formCard}>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="યુઝરનું નામ" />
          <Dropdown label="રોલ (Role)" options={[{label:'Super Admin', value:'super_admin'}, {label:'Admin', value:'admin'}, {label:'Cash Counter', value:'counter'}, {label:'Production (રસોડું)', value:'production'}]} selectedValue={role} onSelect={setRole} />
          <View style={s.chipContainer}>{places.map(p => { const isSel = selectedDutyPlaces.includes(p.id); return <Pressable key={p.id} onPress={() => setSelectedDutyPlaces(isSel ? selectedDutyPlaces.filter(id => id !== p.id) : [...selectedDutyPlaces, p.id])} style={[s.chip, isSel && s.chipSelected]}><Text style={[s.chipText, isSel && s.chipTextSelected]}>{p.name}</Text></Pressable> })}</View>
          <TextInput style={s.input} value={loginEmail} onChangeText={setLoginEmail} placeholder="યુઝર ID (દા.ત. Rasodu1)" autoCapitalize="none" />
          <TextInput style={s.input} value={loginPass} onChangeText={setLoginPass} placeholder={editingId ? "નવો પાસવર્ડ" : "લોગિન પાસવર્ડ"} />
          <Pressable disabled={saving} onPress={saveUser} style={[s.primary]}><Text style={s.primaryText}>{saving ? 'સેવ થઈ રહ્યું છે...' : 'સેવ કરો'}</Text></Pressable>
          <Pressable onPress={() => setShowForm(false)} style={s.closeButton}><Text>કેન્સલ</Text></Pressable>
        </View>
      ) : ( <Pressable onPress={() => {setEditingId(null); setName(''); setLoginEmail(''); setLoginPass(''); setSelectedDutyPlaces([]); setShowForm(true);}} style={[s.primary, {backgroundColor: '#4f46e5'}]}><Text style={s.primaryText}>＋ નવો યુઝર બનાવો</Text></Pressable> )}
      {users.map(u => <View key={u.id} style={s.listCard}><Text style={{fontWeight:'bold', fontSize:16}}>{u.full_name}</Text></View>)}
    </View>
  );
}

// ================= COUNTER & PRODUCTION (WITH NEW SORTING) =================
function CounterHome({ session, profile }: { session: Session, profile: Profile }) {
  const [activeTab, setActiveTab] = useState<'home'|'new_booking'>('home');
  const [todayData, setTodayData] = useState({ total: 0, mealMap: {} as any });
  const [tomorrowData, setTomorrowData] = useState({ total: 0, mealMap: {} as any });
  const [places, setPlaces] = useState<any[]>([]); const { sortedMains } = useSortedCategories();

  useEffect(() => { if (activeTab === 'home') fetchDashboard(); }, [activeTab]);

  async function fetchDashboard() {
    if (!supabase) return;
    try {
      let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });
      if (profile.duty_places && profile.duty_places.length > 0) query = query.or(profile.duty_places.map(p => `place_id.eq.${p}`).join(','));
      const { data } = await query; const { data: pData } = await supabase.from('places').select('*');
      if (data) {
        const tStr = getTodayStr(); const tomStr = getTomorrowStr();
        let tData = { total: 0, mealMap: {} as any }; let tomData = { total: 0, mealMap: {} as any };
        data.forEach(b => {
          if (b.meals) {
            b.meals.forEach((m: any) => {
              const g = m.guestsCount || 0; const hostName = `${b.name || ''}`.trim() || 'અજ્ઞાત યજમાન';
              if (m.date === tStr) { tData.total += g; if(!tData.mealMap[m.mainType]) tData.mealMap[m.mainType] = { count: 0, hosts: [] }; tData.mealMap[m.mainType].count += g; tData.mealMap[m.mainType].hosts.push(`${hostName} (${g})`); }
              if (m.date === tomStr) { tomData.total += g; if(!tomData.mealMap[m.mainType]) tomData.mealMap[m.mainType] = { count: 0, hosts: [] }; tomData.mealMap[m.mainType].count += g; tomData.mealMap[m.mainType].hosts.push(`${hostName} (${g})`); }
            });
          }
        });
        setTodayData(tData); setTomorrowData(tomData);
      }
      if (pData) setPlaces(pData);
    } catch (err: any) { showMsg('Error', err.message); }
  }

  if (activeTab === 'new_booking') return <BookingScreen onBack={() => {setActiveTab('home'); fetchDashboard();}} session={session} profile={profile} allowedPlaces={places.filter(p=>(profile.duty_places||[]).includes(p.id))} />;

  return (
    <View style={s.p18}>
      <Text style={s.h1}>કેશ કાઉન્ટર</Text>
      <PreviewWidget title="🍽️ આજના યજમાનો" dateStr={getTodayStr()} data={todayData} bgColor="#f0fdf4" borderColor="#6ee7b7" sortOrder={sortedMains} />
      <PreviewWidget title="🍽️ આવતીકાલના યજમાનો" dateStr={getTomorrowStr()} data={tomorrowData} bgColor="#fffbeb" borderColor="#fde047" sortOrder={sortedMains} />
      <Pressable onPress={() => setActiveTab('new_booking')} style={[s.primary, {marginBottom: 20}]}><Text style={s.primaryText}>＋ નવી બુકિંગ બનાવો</Text></Pressable>
    </View>
  );
}

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

// ================= BOOKING & OTHER UTILS =================
function BookingScreen({ onBack, session, profile, initialData, allowedPlaces }: { onBack: () => void, session: Session, profile: Profile, initialData?: any, allowedPlaces?: any[] }) {
  const [places, setPlaces] = useState<any[]>(allowedPlaces || []); const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialData?.name || ''); const [mobile, setMobile] = useState(initialData?.mobile || '');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(initialData?.place_id || (allowedPlaces?.length === 1 ? allowedPlaces[0].id : null));
  const [meals, setMeals] = useState<any[]>(initialData?.meals || []); 
  const [paymentStatus, setPaymentStatus] = useState(initialData?.payment_status || 'પૂર્ણ સેવા'); 

  useEffect(() => { async function fetchData() { if (!supabase) return; if (!allowedPlaces) { const { data } = await supabase.from('places').select('*').eq('is_active', true); if (data) setPlaces(data.map(p => ({ label: p.name, value: p.id }))); } else setPlaces(allowedPlaces.map(p => ({ label: p.name || p.label, value: p.id || p.value }))); } fetchData(); }, []);

  let grandTotal = 0; meals.forEach(m => grandTotal += (m.ratePerPlate * (m.guestsCount || 0)));

  async function handleSaveBooking() {
    if (!name || !mobile || meals.length === 0) return showMsg('અધૂરી માહિતી', 'નામ, નંબર અને 1 જમણવાર જરૂરી છે.');
    if (!selectedPlaceId) return showMsg('ભૂલ', 'સ્થળ પસંદ કરવું ફરજિયાત છે.');
    if (!supabase) return; setSaving(true);
    try {
      const payload = { name, mobile, place_id: selectedPlaceId, meals, payment_status: paymentStatus, grand_total: grandTotal, user_id: session.user.id };
      const res = initialData?.id ? await supabase.from('bookings').update(payload).eq('id', initialData.id) : await supabase.from('bookings').insert([payload]);
      if (res.error) throw res.error; showMsg('સફળતા 🎉', `બુકિંગ સેવ થઈ ગયું!`); onBack();
    } catch (err: any) { showMsg('Error', err.message); } finally { setSaving(false); }
  }
  return (<View style={s.p18}><Pressable onPress={onBack} style={s.backButton}><Text style={s.backText}>‹ પાછા</Text></Pressable><Text style={s.h1}>{initialData ? 'બુકિંગ એડિટ' : 'નવી બુકિંગ'}</Text><View style={s.formCard}><TextInput placeholder="નામ" style={s.input} value={name} onChangeText={setName} /><TextInput placeholder="મોબાઇલ નંબર" style={s.input} keyboardType="phone-pad" value={mobile} onChangeText={setMobile} />{places.length === 1 ? <Text style={s.label}>સ્થળ: {places[0].label}</Text> : <Dropdown label="સ્થળ પસંદ કરો" options={places} selectedValue={selectedPlaceId} onSelect={setSelectedPlaceId} />}<Pressable disabled={saving} onPress={handleSaveBooking} style={s.saveBtn}><Text style={s.saveBtnText}>{saving ? 'Saving...' : 'બુકિંગ સેવ કરો'}</Text></Pressable></View></View>);
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
function TodayReportScreen({ onBack }: any) { return <View style={s.p18}><Pressable onPress={onBack}><Text style={s.backText}>‹ પાછા</Text></Pressable><Text style={s.h1}>Report</Text></View>; }
function AllBookingsScreen({ onBack }: any) { return <View style={s.p18}><Pressable onPress={onBack}><Text style={s.backText}>‹ પાછા</Text></Pressable><Text style={s.h1}>All Bookings</Text></View>; }

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
  backButton:{alignSelf:'flex-start',paddingVertical:6,paddingHorizontal:2,marginBottom:10}, backText:{fontSize:15,fontWeight:'700',color:'#047857'}, 
  formCard:{backgroundColor:'#ffffff',borderRadius:16,padding:20,marginTop:12,borderWidth:1,borderColor:'#e2e8f0'}, sectionTitle:{fontSize:18,fontWeight:'900',marginBottom:14, color: '#1e293b'}, 
  menuBtn: { backgroundColor: '#ffffff', padding: 18, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }, menuBtnText: { color: '#1e293b', fontSize: 16, fontWeight: 'bold' }, 
  listCard: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, backgroundColor:'#ffffff', marginBottom:10, borderRadius:12, borderWidth:1, borderColor:'#e2e8f0' }, 
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }, editBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff' }, editBtnText: { fontWeight: 'bold', color: '#475569', fontSize: 13 }, 
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }, modalContent: { backgroundColor: '#ffffff', borderRadius: 20, padding: 22, margin: 20, maxHeight: '80%', borderWidth: 1, borderColor: '#e2e8f0' }, 
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 15, color: '#1e293b' }, modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }, modalItemText: { fontSize: 16, color: '#334155' }, closeButton: { marginTop: 12, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 10, alignItems: 'center' }, closeText: { fontWeight: 'bold', color: '#475569' }, 
  refreshBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#f1f5f9', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' }, refreshBtnText: { fontSize: 14, color: '#1e3a8a', fontWeight: 'bold' },
  prodTabBar: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 15 }, prodTabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 }, prodTabBtnActive: { backgroundColor: '#ffffff' }, prodTabBtnText: { fontWeight: 'bold', color: '#64748b' }, prodTabBtnTextActive: { color: '#047857', fontWeight: '900' },
  saveBtn: { backgroundColor: '#d97706', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 }, saveBtnText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  mainTypeHeader: { fontSize: 20, fontWeight: '900', color: '#047857', borderBottomWidth: 2, borderBottomColor: '#047857', paddingBottom: 6, marginBottom: 12, marginTop: 10 }, collapsibleHeader: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }, collapsibleHeaderText: { fontSize: 16, fontWeight: 'bold', color: '#1e3a8a' }, collapsibleHeaderIcon: { fontSize: 14, color: '#1e3a8a', fontWeight: 'bold' }, chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 4, marginBottom: 15 }, chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 25, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff' }, chipSelected: { backgroundColor: '#047857', borderColor: '#047857' }, chipText: { fontSize: 14, color: '#475569', fontWeight: '600' }, chipTextSelected: { color: '#ffffff' },
  // ડ્રેગ એન્ડ ડ્રોપ સ્ટાઈલ
  dragItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee', cursor: 'grab' },
  dragHandle: { fontSize: 20, color: '#94a3b8', marginRight: 15, fontWeight: 'bold' },
  dragging: { backgroundColor: '#f1f5f9', opacity: 0.8, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8 }
});