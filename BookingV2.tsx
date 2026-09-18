import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { supabase } from './supabase';

type Place = { id: string; name: string };
type Item = { id: string; name: string; meal_period: 'breakfast' | 'lunch' | 'dinner' };
type Props = { profileId: string; onSaved: () => void; s: any };

const times = Array.from({ length: 96 }, (_, i) => {
  const hour = Math.floor(i / 4); const minute = (i % 4) * 15;
  const suffix = hour < 12 ? 'AM' : 'PM'; const shown = hour % 12 || 12;
  return { value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`, label: `${shown}:${String(minute).padStart(2, '0')} ${suffix}` };
});

export default function BookingV2({ profileId, onSaved, s }: Props) {
  const [places, setPlaces] = useState<Place[]>([]); const [items, setItems] = useState<Item[]>([]); const [meal, setMeal] = useState<Item['meal_period']>('breakfast');
  const [date, setDate] = useState(''); const [name, setName] = useState(''); const [mobile, setMobile] = useState(''); const [people, setPeople] = useState(''); const [place, setPlace] = useState(''); const [receipt, setReceipt] = useState(''); const [rasoi, setRasoi] = useState(''); const [thakorji, setThakorji] = useState(''); const [time, setTime] = useState(times[0]); const [pickTime, setPickTime] = useState(false); const [selected, setSelected] = useState<string[]>([]); const [saving, setSaving] = useState(false);
  useEffect(() => { if (!supabase) return; supabase.from('booking_places').select('id,name').order('name').then(({ data }) => setPlaces((data || []) as Place[])); supabase.from('available_menu_items').select('id,name,meal_period').order('name').then(({ data }) => setItems((data || []) as Item[])); }, []);
  const finalTotal = useMemo(() => (Number(rasoi) || 0) + (Number(thakorji) || 0), [rasoi, thakorji]);
  const choose = (id: string) => setSelected(x => x.includes(id) ? x.filter(v => v !== id) : [...x, id]);
  async function save() {
    if (!date || !name.trim() || mobile.length !== 10 || !people || !place || !receipt.trim()) return Alert.alert('Complete required details', 'Fill date, name, 10-digit mobile, people, place and receipt number.');
    if (!supabase) return; setSaving(true);
    const { error } = await supabase.rpc('create_booking', { p_service_date: date, p_customer_name: name.trim(), p_mobile: mobile, p_people_count: Number(people), p_place_id: place, p_service_time: time.value, p_receipt_number: receipt.trim(), p_rasoi_seva_amount: Number(rasoi) || 0, p_thakorji_seva_amount: Number(thakorji) || 0, p_menu_item_ids: selected, p_custom_values: {} });
    setSaving(false); if (error) return Alert.alert('Could not save', error.message); Alert.alert('Booking saved', `Receipt ${receipt} has been saved.`); onSaved();
  }
  return <View><Text style={s.h1}>New Booking / નવું બુકિંગ</Text>
    <Label text="Date / તારીખ" s={s}/><TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={s.input}/>
    <Label text="Name / નામ" s={s}/><TextInput value={name} onChangeText={setName} style={s.input}/>
    <Label text="Mobile number / મોબાઇલ નંબર" s={s}/><TextInput value={mobile} onChangeText={v=>setMobile(v.replace(/\D/g,'').slice(0,10))} keyboardType="number-pad" style={s.input}/>
    <Label text="Number of people / વ્યક્તિઓ" s={s}/><TextInput value={people} onChangeText={setPeople} keyboardType="number-pad" style={s.input}/>
    <Label text="Place / સ્થળ" s={s}/><View style={s.roleRow}>{places.map(p=><Pressable key={p.id} onPress={()=>setPlace(p.id)} style={[s.roleChip, place===p.id&&s.roleChipOn]}><Text>{p.name}</Text></Pressable>)}</View>
    <Label text="Time / સમય" s={s}/><Pressable onPress={()=>setPickTime(true)} style={s.action}><Text style={s.actionText}>{time.label}</Text><Text>⌄</Text></Pressable>
    <Label text="Receipt number / રસીદ નંબર" s={s}/><TextInput value={receipt} onChangeText={setReceipt} placeholder="123/12" style={s.input}/>
    <Label text="Rasoi Seva (₹) / રસોઈ સેવા" s={s}/><TextInput value={rasoi} onChangeText={setRasoi} keyboardType="decimal-pad" style={s.input}/>
    <Label text="Thakorji Seva (₹) / ઠાકોરજી સેવા" s={s}/><TextInput value={thakorji} onChangeText={setThakorji} keyboardType="decimal-pad" style={s.input}/>
    <Text style={s.label}>Menu / મેનુ</Text><View style={s.roleRow}>{(['breakfast','lunch','dinner'] as const).map(m=><Pressable key={m} onPress={()=>setMeal(m)} style={[s.roleChip,meal===m&&s.roleChipOn]}><Text>{m[0].toUpperCase()+m.slice(1)}</Text></Pressable>)}</View>
    {items.filter(i=>i.meal_period===meal).map(i=><Pressable key={i.id} onPress={()=>choose(i.id)} style={s.action}><Text>{selected.includes(i.id)?'✓ ':''}{i.name}</Text></Pressable>)}
    <View style={s.booking}><Text style={s.userName}>Final Total / અંતિમ કુલ</Text><Text style={s.value}>₹{finalTotal.toFixed(2)}</Text></View><Pressable disabled={saving} onPress={save} style={[s.primary,saving&&s.disabled]}><Text style={s.primaryText}>{saving?'Saving…':'Save Booking / બુકિંગ સેવ કરો'}</Text></Pressable>
    <Modal visible={pickTime} animationType="slide"><ScrollView contentContainerStyle={{padding:20}}><Text style={s.h1}>Select time / સમય પસંદ કરો</Text>{times.map(t=><Pressable key={t.value} onPress={()=>{setTime(t);setPickTime(false)}} style={s.action}><Text>{t.label}</Text></Pressable>)}</ScrollView></Modal>
  </View>;
}
function Label({ text, s }: { text: string; s: any }) { return <Text style={s.label}>{text}</Text>; }
