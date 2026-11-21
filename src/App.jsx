import React, { useEffect, useMemo, useState } from "react";
import { Client, Account, TablesDB, ID, Query } from "appwrite";
import {
  BookOpen, CalendarDays, History, Plus, Search, Clock3, Users,
  ChefHat, Check, Pencil, Trash2, X, ChevronLeft, ChevronRight,
  LogIn, LogOut, Cloud, CloudOff, Sparkles, ArrowLeftRight, CircleCheck
} from "lucide-react";
import { LABELS, SEED } from "./data";

const env = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT,
  project: import.meta.env.VITE_APPWRITE_PROJECT_ID,
  db: import.meta.env.VITE_APPWRITE_DATABASE_ID,
  recipes: import.meta.env.VITE_APPWRITE_RECIPES_COLLECTION_ID,
  plans: import.meta.env.VITE_APPWRITE_PLANS_COLLECTION_ID,
  history: import.meta.env.VITE_APPWRITE_HISTORY_COLLECTION_ID,
  team: import.meta.env.VITE_APPWRITE_TEAM_ID
};

// Alle sieben Werte müssen gesetzt sein, damit die App den Cloud-Modus verwendet.
const cloudReady = Object.values(env).every(Boolean);
const client = new Client();
if (cloudReady) client.setEndpoint(env.endpoint).setProject(env.project);
const account = cloudReady ? new Account(client) : null;
const db = cloudReady ? new TablesDB(client) : null;

const today = new Date();
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const plusDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const mondayOf = d => { const x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-(x.getDay()+6)%7); return x; };
const daysBetween = date => date ? Math.max(0,Math.floor((new Date(iso(today))-new Date(date))/86400000)) : null;
const dateLabel = d => new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit"}).format(d);

// Die Teamrechte werden in Appwrite auf Tabellenebene vergeben.
// Deshalb werden beim Erstellen von Zeilen hier keine eigenen Zeilenrechte gesetzt.

function App() {
  const [section,setSection] = useState("recipes");
  const [recipes,setRecipes] = useState([]);
  const [plans,setPlans] = useState([]);
  const [history,setHistory] = useState([]);
  const [filter,setFilter] = useState("Alle");
  const [search,setSearch] = useState("");
  const [week,setWeek] = useState(mondayOf(today));
  const [modal,setModal] = useState(false);
  const [editing,setEditing] = useState(null);
  const [user,setUser] = useState(null);
  const [authOpen,setAuthOpen] = useState(false);
  const [authMode,setAuthMode] = useState("login");
  const [authEmail,setAuthEmail] = useState("");
  const [authPassword,setAuthPassword] = useState("");
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const [form,setForm] = useState(emptyForm());
  const demo = !cloudReady;

  function emptyForm(){ return {name:"",category:"Hauptgericht",minutes:"30",servings:"2",ingredients:"",instructions:"",labels:[]}; }

  useEffect(() => {
    if (!cloudReady) {
      setRecipes(JSON.parse(localStorage.getItem("rk_recipes") || "null") || SEED);
      setPlans(JSON.parse(localStorage.getItem("rk_plans") || "[]"));
      setHistory(JSON.parse(localStorage.getItem("rk_history") || "[]"));
      return;
    }
    account.get().then(setUser).catch(()=>setAuthOpen(true));
  }, []);

  useEffect(() => {
    if (demo) {
      localStorage.setItem("rk_recipes",JSON.stringify(recipes));
      localStorage.setItem("rk_plans",JSON.stringify(plans));
      localStorage.setItem("rk_history",JSON.stringify(history));
    }
  },[recipes,plans,history]);

  useEffect(() => {
    if (cloudReady && user) loadCloud();
  },[user]);

  async function loadCloud(){
    try {
      const [r,p,h] = await Promise.all([
        db.listRows({databaseId:env.db,tableId:env.recipes,queries:[Query.limit(100)]}),
        db.listRows({databaseId:env.db,tableId:env.plans,queries:[Query.limit(300)]}),
        db.listRows({databaseId:env.db,tableId:env.history,queries:[Query.orderDesc("cookedAt"),Query.limit(300)]})
      ]);
      setRecipes((r.rows || []).map(row=>({...row,lastCooked:row.lastcooked || null})));
      setPlans(p.rows || []);
      setHistory(h.rows || []);
    } catch(e){ setNotice("Daten konnten nicht geladen werden: "+e.message); }
  }

  const saveRecipe = async data => {
    try {
      if (demo) {
        if (editing) setRecipes(v=>v.map(x=>x.$id===editing.$id?{...x,...data}:x));
        else setRecipes(v=>[{...data,$id:"local-"+Date.now(),lastCooked:null,lastcooked:null},...v]);
      } else {
        const payload={
          name:data.name,
          category:data.category || "Hauptgericht",
          minutes:Number(data.minutes)||0,
          servings:Number(data.servings)||2,
          ingredients:data.ingredients || "",
          instructions:data.instructions || "",
          labels:data.labels || []
        };
        if (editing) await db.updateRow({databaseId:env.db,tableId:env.recipes,rowId:editing.$id,data:payload});
        else await db.createRow({databaseId:env.db,tableId:env.recipes,rowId:ID.unique(),data:{...payload,lastcooked:null}});
        await loadCloud();
      }
      setModal(false); setEditing(null); setNotice(editing?"Rezept aktualisiert":"Rezept gespeichert");
    } catch(e) { setNotice("Rezept konnte nicht gespeichert werden: "+e.message); }
  };

  const deleteRecipe = async recipe => {
    if(!confirm(`„${recipe.name}“ wirklich löschen?`)) return;
    try {
      if(demo) setRecipes(v=>v.filter(x=>x.$id!==recipe.$id));
      else { await db.deleteRow({databaseId:env.db,tableId:env.recipes,rowId:recipe.$id}); await loadCloud(); }
    } catch(e) { setNotice("Rezept konnte nicht gelöscht werden: "+e.message); }
  };

  const planRecipe = async (date,recipeId) => {
    const old=plans.find(p=>p.date===date);
    try {
      if(demo) setPlans(v=>old?v.map(x=>x.$id===old.$id?{...x,recipeId,status:"planned"}:x):[...v,{$id:"p"+Date.now(),date,recipeId,status:"planned"}]);
      else {
        if(old) await db.updateRow({databaseId:env.db,tableId:env.plans,rowId:old.$id,data:{recipeId,status:"planned"}});
        else await db.createRow({databaseId:env.db,tableId:env.plans,rowId:ID.unique(),data:{date,recipeId,status:"planned"}});
        await loadCloud();
      }
    } catch(e) { setNotice("Gericht konnte nicht eingeplant werden: "+e.message); }
  };

  const markCooked = async date => {
    const plan=plans.find(p=>p.date===date);
    if(!plan) return;
    const recipe=recipes.find(r=>r.$id===plan.recipeId);
    if(!recipe) { setNotice("Das Rezept zu diesem Plan-Eintrag wurde nicht gefunden."); return; }
    try {
      if(demo){
        setPlans(v=>v.map(p=>p.$id===plan.$id?{...p,status:"cooked"}:p));
        setRecipes(v=>v.map(r=>r.$id===recipe.$id?{...r,lastCooked:date,lastcooked:date}:r));
        setHistory(v=>[{$id:"h"+Date.now(),recipeId:recipe.$id,recipeName:recipe.name,cookedAt:date},...v]);
      } else {
        await db.updateRow({databaseId:env.db,tableId:env.plans,rowId:plan.$id,data:{status:"cooked"}});
        await db.updateRow({databaseId:env.db,tableId:env.recipes,rowId:recipe.$id,data:{lastcooked:date}});
        await db.createRow({databaseId:env.db,tableId:env.history,rowId:ID.unique(),data:{recipeId:recipe.$id,recipeName:recipe.name,cookedAt:date}});
        await loadCloud();
      }
      setNotice(`${recipe.name} als gekocht markiert`);
    } catch(e) { setNotice("Kochdatum konnte nicht gespeichert werden: "+e.message); }
  };

  const signIn = async e => {
    e.preventDefault(); setBusy(true);
    try {
      if(authMode==="register") await account.create(ID.unique(),authEmail,authPassword);
      await account.createEmailPasswordSession(authEmail,authPassword);
      setUser(await account.get()); setAuthOpen(false);
    } catch(err){setNotice(err.message);}
    finally{setBusy(false);}
  };
  const signOut = async()=>{
    try { await account.deleteSession("current"); setUser(null); setRecipes([]); setPlans([]); setHistory([]); setAuthOpen(true); }
    catch(e) { setNotice("Abmelden fehlgeschlagen: "+e.message); }
  };

  const filtered = useMemo(()=>recipes.filter(r=>
    (filter==="Alle" || (r.labels||[]).includes(filter)) &&
    `${r.name} ${r.ingredients||""}`.toLowerCase().includes(search.toLowerCase())
  ),[recipes,filter,search]);
  const plannedWeek = Array.from({length:7},(_,i)=>plusDays(week,i));
  const openNew=()=>{setEditing(null);setForm(emptyForm());setModal(true);};
  const openEdit=r=>{setEditing(r);setForm({name:r.name||"",category:r.category||"Hauptgericht",minutes:String(r.minutes||30),servings:String(r.servings||2),ingredients:r.ingredients||"",instructions:r.instructions||"",labels:r.labels||[]});setModal(true);};
  const title = {recipes:"Eure Rezepte",planner:"Wochenplan",history:"Kochhistorie"}[section];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><ChefHat size={22}/></div><div><b>rezeptkompass</b><small>EUER HAUSHALTSKOCHBUCH</small></div></div>
      <div className="nav-label">MENÜ</div>
      <button className={section==="recipes"?"nav active":"nav"} onClick={()=>setSection("recipes")}><BookOpen size={18}/>Rezepte<span>{recipes.length}</span></button>
      <button className={section==="planner"?"nav active":"nav"} onClick={()=>setSection("planner")}><CalendarDays size={18}/>Wochenplan</button>
      <button className={section==="history"?"nav active":"nav"} onClick={()=>setSection("history")}><History size={18}/>Kochhistorie</button>
      <div className="sidebar-bottom">
        <div className="sync-card">{demo?<CloudOff size={17}/>:<Cloud size={17}/>}<div><b>{demo?"Demo-Modus":"Cloud verbunden"}</b><small>{demo?"Nur auf diesem Gerät":"Appwrite-Datenbank"}</small></div></div>
        {cloudReady && user && <button className="nav" onClick={signOut}><LogOut size={17}/>Abmelden</button>}
        <div className="user-note"><div className="avatar">RK</div><div><b>Unser Zuhause</b><small>Gemeinsam kochen</small></div></div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="mobile-brand"><ChefHat/> rezeptkompass</div><div className="crumb">Haushalt <span>/</span> {title}</div><div className="top-actions">{demo?<span className="mode-pill"><span/>Lokale Vorschau</span>:<span className="mode-pill online"><span/>Synchronisiert</span>}{cloudReady&&!user&&<button className="btn btn-light" onClick={()=>setAuthOpen(true)}><LogIn size={16}/> Anmelden</button>}</div></header>
      <div className="content">
        {notice && <div className="notice" onClick={()=>setNotice("")}>{notice}<X size={15}/></div>}
        {section==="recipes" && <>
          <div className="page-heading"><div><div className="eyebrow">DIE REZEPTSAMMLUNG</div><h1>Was kochen wir heute?</h1><p>Alle Lieblingsgerichte an einem Ort – gut sortiert und jederzeit griffbereit.</p></div><button className="btn btn-primary" onClick={openNew}><Plus size={18}/> Rezept hinzufügen</button></div>
          <div className="stats-row"><div className="stat"><span>GESAMTE REZEPTE</span><b>{recipes.length}</b></div><div className="stat"><span>KATEGORIEN</span><b>{new Set(recipes.flatMap(r=>r.labels||[])).size}</b></div><div className="stat"><span>IN DIESEM MONAT GEKOCHT</span><b>{history.filter(h=>h.cookedAt?.slice(0,7)===iso(today).slice(0,7)).length}</b></div></div>
          <div className="toolbar"><div className="searchbox"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rezepte oder Zutaten suchen …"/></div><div className="filters"><button className={filter==="Alle"?"filter active-filter":"filter"} onClick={()=>setFilter("Alle")}>Alle</button>{LABELS.map(l=><button key={l} className={filter===l?"filter active-filter":"filter"} onClick={()=>setFilter(l)}>{l}</button>)}</div></div>
          <div className="section-caption"><b>{filtered.length} {filtered.length===1?"Rezept":"Rezepte"}</b><span>Nach Kategorie filtern</span></div>
          {filtered.length===0?<Empty title="Noch nichts gefunden" text="Passe deine Suche an oder füge ein neues Rezept hinzu."/>:
            <div className="recipe-grid">{filtered.map(r=><RecipeCard key={r.$id} recipe={r} onEdit={()=>openEdit(r)} onDelete={()=>deleteRecipe(r)}/>)}</div>}
        </>}
        {section==="planner" && <>
          <div className="page-heading"><div><div className="eyebrow">GEMEINSAM VORAUSPLANEN</div><h1>Unser Wochenplan</h1><p>Sieben Tage, viele Möglichkeiten. Änderungen sind jederzeit möglich.</p></div><button className="btn btn-light" onClick={()=>setWeek(mondayOf(today))}>Diese Woche</button></div>
          <div className="week-switch"><button className="icon-btn" onClick={()=>setWeek(plusDays(week,-7))}><ChevronLeft/></button><div><b>{new Intl.DateTimeFormat("de-DE",{day:"numeric",month:"long"}).format(week)} – {new Intl.DateTimeFormat("de-DE",{day:"numeric",month:"long",year:"numeric"}).format(plusDays(week,6))}</b><small>Wochenübersicht</small></div><button className="icon-btn" onClick={()=>setWeek(plusDays(week,7))}><ChevronRight/></button></div>
          <div className="week-grid">{plannedWeek.map((d,i)=>{const date=iso(d),plan=plans.find(p=>p.date===date),recipe=recipes.find(r=>r.$id===plan?.recipeId);return <div className={`day-card ${date===iso(today)?"today":""}`} key={date}><div className="day-head"><div><b>{["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"][i]}</b><small>{dateLabel(d)}</small></div>{date===iso(today)&&<span className="today-tag">HEUTE</span>}</div>{recipe?<div className="planned-meal"><div className="meal-icon">{(recipe.labels||[]).includes("Fisch")?"🐟":(recipe.labels||[]).includes("Vegetarisch")?"🥬":(recipe.labels||[]).includes("Süßspeise")?"🍰":"🍽️"}</div><b>{recipe.name}</b><div className="meal-meta"><span><Clock3 size={13}/>{recipe.minutes||"–"} Min.</span><span className={plan.status==="cooked"?"cooked-label":""}>{plan.status==="cooked"?"Gekocht":"Geplant"}</span></div><button className="change-meal" onClick={()=>chooseMeal(date)}><ArrowLeftRight size={14}/> Austauschen</button>{plan.status!=="cooked"&&<button className="mark-cooked" onClick={()=>markCooked(date)}><Check size={14}/> Als gekocht markieren</button>}</div>:<button className="add-day" onClick={()=>chooseMeal(date)}><Plus size={19}/><span>Gericht einplanen</span></button>}</div>})}</div>
          <div className="planner-tip"><Sparkles size={17}/><span><b>Kleiner Planungstipp:</b> Mischt verschiedene Kategorien, damit Abwechslung auf den Tisch kommt.</span></div>
        </>}
        {section==="history" && <>
          <div className="page-heading"><div><div className="eyebrow">DIE KULINARISCHE ZEITREISE</div><h1>Was kam auf den Tisch?</h1><p>Hier seht ihr, wann ihr eure Gerichte tatsächlich gekocht habt.</p></div></div>
          <div className="stats-row"><div className="stat"><span>ERFASSTE KOCHTAGE</span><b>{history.length}</b></div><div className="stat"><span>VERSCHIEDENE GERICHTE</span><b>{new Set(history.map(h=>h.recipeId)).size}</b></div></div>
          {history.length===0?<Empty title="Noch keine Kochhistorie" text="Markiert im Wochenplan ein Gericht als „Gekocht“, dann erscheint es hier."/>:
          <div className="history-list">{[...history].sort((a,b)=>(b.cookedAt||"").localeCompare(a.cookedAt||"")).map(h=><div className="history-item" key={h.$id}><div className="history-check"><CircleCheck size={20}/></div><div className="history-name"><b>{h.recipeName||recipes.find(r=>r.$id===h.recipeId)?.name||"Gelöschtes Rezept"}</b><small>Als gekocht markiert</small></div><div className="history-date">{new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"long",year:"numeric"}).format(new Date(h.cookedAt+"T12:00:00"))}</div></div>)}</div>}
          <h2 className="subheading">Lange nicht mehr gekocht</h2><div className="stale-grid">{[...recipes].sort((a,b)=>(a.lastcooked||a.lastCooked||"1900").localeCompare(b.lastcooked||b.lastCooked||"1900")).slice(0,4).map(r=>{const cooked=r.lastcooked||r.lastCooked;return <div className="stale-card" key={r.$id}><b>{r.name}</b><small>{cooked?`Zuletzt vor ${daysBetween(cooked)} Tagen gekocht`:"Noch kein Kochdatum erfasst"}</small></div>})}</div>
        </>}
      </div>
    </main>

    {modal && <RecipeModal form={form} setForm={setForm} editing={editing} onClose={()=>{setModal(false);setEditing(null)}} onSave={saveRecipe}/>}
    {authOpen && cloudReady && <div className="overlay"><form className="auth-modal" onSubmit={signIn}><button type="button" className="close" onClick={()=>setAuthOpen(false)}><X/></button><div className="modal-icon"><ChefHat/></div><h2>{authMode==="login"?"Willkommen zurück":"Haushaltskonto erstellen"}</h2><p>Mit eurem Appwrite-Konto auf eure gemeinsame Rezeptsammlung zugreifen.</p><label>E-Mail-Adresse<input type="email" required value={authEmail} onChange={e=>setAuthEmail(e.target.value)}/></label><label>Passwort<input type="password" minLength="8" required value={authPassword} onChange={e=>setAuthPassword(e.target.value)}/></label><button className="btn btn-primary full" disabled={busy}>{busy?"Einen Moment …":authMode==="login"?"Anmelden":"Konto erstellen"}</button><button type="button" className="text-button" onClick={()=>setAuthMode(authMode==="login"?"register":"login")}>{authMode==="login"?"Noch kein Konto? Registrieren":"Schon ein Konto? Anmelden"}</button></form></div>}
  </div>;

  function chooseMeal(date){
    if (recipes.length===0) { setNotice("Lege zuerst ein Rezept an, bevor du es einplanst."); return; }
    const choice=prompt(`Welches Gericht für ${date}?\n\n`+recipes.map((r,i)=>`${i+1}. ${r.name}`).join("\n")+"\n\nNummer eingeben:");
    const index=Number(choice)-1;
    if(choice!==null && recipes[index]) planRecipe(date,recipes[index].$id);
  }
}

function RecipeCard({recipe:r,onEdit,onDelete}){
  const cooked = r.lastcooked || r.lastCooked;
  const days= cooked ? Math.max(0,Math.floor((new Date().setHours(0,0,0,0)-new Date(cooked).getTime())/86400000)) : null;
  return <article className="recipe-card"><div className="recipe-art"><span className="food-emoji">{(r.labels||[]).includes("Fisch")?"🐟":(r.labels||[]).includes("Vegetarisch")?"🥗":(r.labels||[]).includes("Süßspeise")?"🍰":(r.labels||[]).includes("Fleisch")?"🍲":"🍴"}</span><div className="card-actions"><button title="Bearbeiten" onClick={onEdit}><Pencil size={15}/></button><button title="Löschen" onClick={onDelete}><Trash2 size={15}/></button></div></div><div className="recipe-body"><div className="recipe-tags">{(r.labels||[]).map(l=><span key={l} className={`tag tag-${l.toLowerCase()}`}>{l}</span>)}</div><h3>{r.name}</h3><div className="recipe-meta"><span><Clock3 size={14}/>{r.minutes||"–"} Min.</span><span><Users size={14}/>{r.servings||"–"} Portionen</span></div><div className="last-cooked">{cooked?<><History size={14}/> Zuletzt vor {days} Tagen gekocht</>:<><History size={14}/> Noch nicht gekocht</>}</div></div></article>
}
function Empty({title,text}){return <div className="empty"><div><BookOpen size={25}/></div><b>{title}</b><p>{text}</p></div>}
function RecipeModal({form,setForm,editing,onClose,onSave}){
  const toggle=l=>setForm(f=>({...f,labels:f.labels.includes(l)?f.labels.filter(x=>x!==l):[...f.labels,l]}));
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="recipe-modal" onSubmit={e=>{e.preventDefault();onSave(form)}}><div className="modal-head"><div><div className="eyebrow">REZEPTSAMMLUNG</div><h2>{editing?"Rezept bearbeiten":"Neues Rezept"}</h2></div><button type="button" className="close" onClick={onClose}><X/></button></div><div className="form-scroll"><label>Gerichtname *<input required autoFocus placeholder="z. B. Gemüse-Lasagne" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><div className="form-row"><label>Zubereitungszeit (Min.)<input type="number" min="1" value={form.minutes} onChange={e=>setForm({...form,minutes:e.target.value})}/></label><label>Portionen<input type="number" min="1" value={form.servings} onChange={e=>setForm({...form,servings:e.target.value})}/></label></div><label>Zutaten<textarea rows="4" placeholder={"Zutat 1\nZutat 2\nZutat 3"} value={form.ingredients} onChange={e=>setForm({...form,ingredients:e.target.value})}/></label><label>Zubereitung<textarea rows="5" placeholder="Wie wird das Gericht zubereitet?" value={form.instructions} onChange={e=>setForm({...form,instructions:e.target.value})}/></label><div className="label-field"><b>Labels auswählen</b><p>Mehrere Labels pro Gericht möglich.</p><div className="label-options">{LABELS.map(l=><button type="button" key={l} className={form.labels.includes(l)?"label-option selected":"label-option"} onClick={()=>toggle(l)}>{form.labels.includes(l)&&<Check size={13}/>} {l}</button>)}</div></div></div><div className="modal-foot"><button type="button" className="btn btn-light" onClick={onClose}>Abbrechen</button><button className="btn btn-primary"><Check size={16}/> {editing?"Änderungen speichern":"Rezept speichern"}</button></div></form></div>
}
export default App;
