"use client";
import {AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar} from "recharts";
import type {Topic, Attempt} from "@/lib/demo";

export function MasteryChart({topics}: {topics: Topic[]}) {
  return <ResponsiveContainer width="100%" height={200}><BarChart data={topics.map(t => ({name:t.name, mastery:t.mastery}))} margin={{left:-25,right:5}}>
    <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="#ededed"/>
    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} tickFormatter={name => name.length > 18 ? name.slice(0,16) + "…" : name}/>
    <YAxis domain={[0,100]} tickLine={false} axisLine={false} fontSize={12}/>
    <Tooltip/><Bar dataKey="mastery" name="Estimated mastery" fill="#222" radius={[5,5,0,0]} barSize={35}/>
  </BarChart></ResponsiveContainer>;
}

export function PerformanceChart({attempts}: {attempts: Attempt[]}) {
  return <ResponsiveContainer width="100%" height={230}><AreaChart data={[...attempts].reverse().map((a,i) => ({attempt:i+1,score:a.score}))}>
    <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="attempt"/><YAxis domain={[0,100]}/><Tooltip/>
    <Area type="monotone" dataKey="score" name="Quiz score" stroke="#111" fill="#ebebeb"/>
  </AreaChart></ResponsiveContainer>;
}
