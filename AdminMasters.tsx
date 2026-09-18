import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from './supabase';

type Place={id:string;name:string;is_active:boolean}; type Item={id:string;name:string;meal_period:string;price_per_person:number;is_active:boolean}; type Field={id:string;label:string;field_type:string;is_active:boolean};
export default function AdminMasters({s}:{s:any}){
 const [tab,setTab]=useState<'places'|'menu'|'fields'>('places');const [places,setPlaces]=useState<Place[]>([]);const [items,setItems]=useState<Item[]>([]);const [fields,setFields]=useState<Field[]>([]);const [name,setName]=useState('');const [price,setPrice]=useState('');const [meal,setMeal]=useState('breakfast');const [kind,setKind]=useState('text');
 const load=async()=>{if(!supabase)return;const [p,i,f]=await Promise.all([supabase.from('booking_places').select('*').order('name'),supabase.from('menu_items').select('*').order('meal_period').order('name'),supabase.from('booking_custom_fields').select('*').order('sort_order')]);setPlaces((p.data||[])as Place[]);setItems((i.data||[])as Item[]);setFields((f.data||[])as Field[])};useEffect(()=>{load()},[]);
 const add=async()=>{if(!supabase||!name.trim())return;let e:any;if(tab==='places')({error:e}=await supabase.from('booking_places').insert({name:name.trim()}));if(tab==='menu')({error:e}=await supabase.from('menu_items').insert({name:name.trim(),meal_period:meal,price_per_person:Number(price)||0}));if(tab==='fields')({error:e}=await supabase.from('booking_custom_fields').insert({label:name.trim(),field_type:kind}));if(e)return Alert.alert('Could not save',e.message);setName('');setPrice('');load()};
 const toggle=async(table:string,id:string,active:boolean)=>{if(!supabase)return;await supabase.from(table).update({is_active:!active}).eq('id',id);load()};
 return <View><Text style={s.h1}>Admin Setup / એડમિન સેટઅપ</Text><View style={s.roleRow}>{(['places','menu','fields']as const).map(x=><Pressable key={x} onPress={()=>setTab(x)} style={[s.roleChip,tab===x&&s.roleChipOn]}><Text>{x==='places'?'Places / સ્થળ':x==='menu'?'Menu / મેનુ':'Custom Fields'}</Text></Pressable>)}</View>
 <Text style={s.label}>{tab==='places'?'Place name / સ્થળનું નામ':tab==='menu'?'Food item / વાનગી':'New field name / નવું ફીલ્ડ'}</Text><TextInput style={s.input} value={name} onChangeText={setName}/>
 {tab==='menu'&&<><Text style={s.label}>Meal / ભોજન</Text><View style={s.roleRow}>{['breakfast','lunch','dinner'].map(x=><Pressable key={x} onPress={()=>setMeal(x)} style={[s.roleChip,meal===x&&s.roleChipOn]}><Text>{x}</Text></Pressable>)}</View><Text style={s.label}>Price (Admin only)</Text><TextInput style={s.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad"/></>}
 {tab==='fields'&&<View style={s.roleRow}>{['text','number','date','yes_no','select'].map(x=><Pressable key={x} onPress={()=>setKind(x)} style={[s.roleChip,kind===x&&s.roleChipOn]}><Text>{x}</Text></Pressable>)}</View>}
 <Pressable onPress={add} style={s.primary}><Text style={s.primaryText}>Add / ઉમેરો</Text></Pressable>
 {tab==='places'&&places.map(x=><Row key={x.id} text={x.name} active={x.is_active} onPress={()=>toggle('booking_places',x.id,x.is_active)} s={s}/>)}
 {tab==='menu'&&items.map(x=><Row key={x.id} text={`${x.name} • ${x.meal_period} • ₹${x.price_per_person}`} active={x.is_active} onPress={()=>toggle('menu_items',x.id,x.is_active)} s={s}/>)}
 {tab==='fields'&&fields.map(x=><Row key={x.id} text={`${x.label} • ${x.field_type}`} active={x.is_active} onPress={()=>toggle('booking_custom_fields',x.id,x.is_active)} s={s}/>)}
 </View>;
}
function Row({text,active,onPress,s}:{text:string;active:boolean;onPress:()=>void;s:any}){return <Pressable onPress={onPress} style={s.action}><Text>{text}</Text><Text>{active?'Active':'Inactive'}</Text></Pressable>}
