/* data.js — Static data: frame size, typefaces, card themes, outlet list, per-platform palettes and config. */
const FW=1080,FH=1920;
const FACES={serif:'"Iowan Old Style",Georgia,"Times New Roman",serif',
  sans:'"Helvetica Neue",Helvetica,Arial,sans-serif',
  mono:'ui-monospace,"SF Mono",Menlo,Consolas,monospace'};
const SANS=FACES.sans;
const THEMES={
  light:{card:"#FFFFFF",ink:"#12141A",meta:"#6B7280",rule:"#E3E6EA",shadow:"rgba(0,0,0,.30)",grain:0},
  paper:{card:"#F7F3EC",ink:"#1C1A17",meta:"#7A7266",rule:"#E2DACC",shadow:"rgba(0,0,0,.28)",grain:.055},
  dark :{card:"#15171C",ink:"#F2F4F7",meta:"#8B93A0",rule:"#2C313A",shadow:"rgba(0,0,0,.55)",grain:.03}
};
const OUTLETS=[
["Video Games Chronicle","videogameschronicle.com"],["IGN","ign.com"],["Eurogamer","eurogamer.net"],
["GameSpot","gamespot.com"],["Kotaku","kotaku.com"],["Polygon","polygon.com"],["PC Gamer","pcgamer.com"],
["Rock Paper Shotgun","rockpapershotgun.com"],["Game Developer","gamedeveloper.com"],
["GamesIndustry.biz","gamesindustry.biz"],["Push Square","pushsquare.com"],["Nintendo Life","nintendolife.com"],
["Pure Xbox","purexbox.com"],["Digital Foundry","eurogamer.net/digitalfoundry"],["Insider Gaming","insider-gaming.com"],
["Dexerto","dexerto.com"],["Dot Esports","dotesports.com"],["Game Rant","gamerant.com"],["Screen Rant","screenrant.com"],
["TheGamer","thegamer.com"],["Destructoid","destructoid.com"],["Gematsu","gematsu.com"],["Siliconera","siliconera.com"],
["Famitsu","famitsu.com"],["4Gamer","4gamer.net"],["Nintendo Everything","nintendoeverything.com"],
["Wccftech","wccftech.com"],["Windows Central","windowscentral.com"],["VGC","videogameschronicle.com"],
["The Verge","theverge.com"],["Engadget","engadget.com"],["Ars Technica","arstechnica.com"],
["TechCrunch","techcrunch.com"],["CNET","cnet.com"],["Wired","wired.com"],["Tom's Hardware","tomshardware.com"],
["Reuters","reuters.com"],["Associated Press","apnews.com"],["Bloomberg","bloomberg.com"],
["The Wall Street Journal","wsj.com"],["Financial Times","ft.com"],["The New York Times","nytimes.com"],
["The Washington Post","washingtonpost.com"],["BBC News","bbc.co.uk/news"],["The Guardian","theguardian.com"],
["CNBC","cnbc.com"],["Forbes","forbes.com"],["Axios","axios.com"],["Business Insider","businessinsider.com"],
["Sky News","news.sky.com"],["Nikkei","nikkei.com"],["Variety","variety.com"],
["The Hollywood Reporter","hollywoodreporter.com"],["Deadline","deadline.com"],
["Rockstar Games","rockstargames.com"],["Rockstar Newswire","rockstargames.com/newswire"],
["Take-Two Interactive","take2games.com"],["Take-Two Investor Relations","ir.take2games.com"],
["PlayStation Blog","blog.playstation.com"],["Xbox Wire","news.xbox.com"],["Nintendo","nintendo.com"],
["Steam","store.steampowered.com"],["Epic Games","epicgames.com"],["SEC EDGAR","sec.gov/edgar"],
["Newzoo","newzoo.com"],["Circana","circana.com"],["Sensor Tower","sensortower.com"],
["Ampere Analysis","ampereanalysis.com"],["SteamDB","steamdb.info"],["Nielsen","nielsen.com"],["IDC","idc.com"],
["X","x.com"],["Twitter","twitter.com"],["Reddit","reddit.com"],["r/GTA6","reddit.com/r/GTA6"],
["r/GamingLeaksAndRumours","reddit.com/r/GamingLeaksAndRumours"],["YouTube","youtube.com"],
["TikTok","tiktok.com"],["Instagram","instagram.com"],["Threads","threads.net"],["Bluesky","bsky.app"],
["Mastodon","mastodon.social"],["Discord","discord.com"],["Twitch","twitch.tv"],["LinkedIn","linkedin.com"],
["Facebook","facebook.com"]
];

/* ---- which platform family a design belongs to ---- */
const DESIGNS={
  "quote":       {social:false},
  "x-post":      {social:true,brand:"x",post:true},
  "x-reply":     {social:true,brand:"x",post:false},
  "reddit-post": {social:true,brand:"reddit",post:true},
  "reddit-comment":{social:true,brand:"reddit",post:false},
  "yt-comment":  {social:true,brand:"yt",post:false},
  "fb-post":     {social:true,brand:"fb",post:true},
  "fb-comment":  {social:true,brand:"fb",post:false},
  "ig-post":     {social:true,brand:"ig",post:true},
  "ig-comment":  {social:true,brand:"ig",post:false}
};
/* per-brand palette keyed by light/dark */
const BRAND={
  x:{light:{bg:"#FFFFFF",ink:"#0F1419",sub:"#536471",rule:"#EFF3F4",accent:"#1D9BF0",badge:"#1D9BF0",like:"#F91880",rt:"#00BA7C"},
     dark :{bg:"#000000",ink:"#E7E9EA",sub:"#71767B",rule:"#2F3336",accent:"#1D9BF0",badge:"#1D9BF0",like:"#F91880",rt:"#00BA7C"}},
  reddit:{light:{bg:"#FFFFFF",ink:"#1A1A1B",sub:"#7C7C7C",rule:"#EDEFF1",accent:"#FF4500",badge:"#FF4500",like:"#FF4500",rt:"#7193FF"},
     dark :{bg:"#1A1A1B",ink:"#D7DADC",sub:"#818384",rule:"#343536",accent:"#FF4500",badge:"#FF4500",like:"#FF4500",rt:"#7193FF"}},
  yt:{light:{bg:"#FFFFFF",ink:"#0F0F0F",sub:"#606060",rule:"#E5E5E5",accent:"#065FD4",badge:"#606060",like:"#0F0F0F",rt:"#0F0F0F"},
     dark :{bg:"#0F0F0F",ink:"#F1F1F1",sub:"#AAAAAA",rule:"#272727",accent:"#3EA6FF",badge:"#AAAAAA",like:"#F1F1F1",rt:"#F1F1F1"}},
  fb:{light:{bg:"#FFFFFF",ink:"#050505",sub:"#65676B",rule:"#CED0D4",accent:"#1877F2",badge:"#1877F2",like:"#1877F2",rt:"#65676B"},
     dark :{bg:"#242526",ink:"#E4E6EB",sub:"#B0B3B8",rule:"#3E4042",accent:"#2D88FF",badge:"#2D88FF",like:"#2D88FF",rt:"#B0B3B8"}},
  ig:{light:{bg:"#FFFFFF",ink:"#000000",sub:"#737373",rule:"#DBDBDB",accent:"#0095F6",badge:"#3897F0",like:"#FF3040",rt:"#737373"},
     dark :{bg:"#000000",ink:"#FAFAFA",sub:"#A8A8A8",rule:"#262626",accent:"#0095F6",badge:"#3897F0",like:"#FF3040",rt:"#A8A8A8"}}
};
const AVCOL=["#1D9BF0","#FF4500","#7B61FF","#00BA7C","#F91880","#FF7A45","#0095F6","#E1306C"];

/* metric fields shown per brand */
const METRICS={
  x:[["replies","Replies","24"],["retweets","Reposts","318"],["likes","Likes","2.4K"],["views","Views","98K"]],
  reddit:[["likes","Upvotes","3.1K"],["replies","Comments","214"]],
  yt:[["likes","Likes","1.2K"],["replies","Replies","48"]],
  fb:[["likes","Likes","842"],["replies","Comments","96"],["retweets","Shares","23"]],
  ig:[["likes","Likes","5,204"],["replies","Comments","25"],["retweets","Reshares","452"]]
};

const S={
  design:"quote",
  text:"Rockstar says GTA 6 will not be delayed again, and the studio calls the new date final.",
  ranges:[[24,45]],outlet:"",url:"",
  theme:"paper",face:"sans",hlColor:"#FFA8C5",hlStyle:"marker",
  header:true,marks:false,width:75,size:42,ypos:0,guides:true,
  crop:"frame",res:"1",bg:"transparent",fps:"30",format:"still",imgFmt:"png",jq:92,exportName:"",
  anim:true,dur:15,fadeEase:"inout",scaleEase:"back",sFrom:88,over:17,drift:0,hold:6,
  bezier:[.34,1.56,.64,1],
  hlAnim:false,hlOffset:9,hlDur:12,
  mode:"type",view:"frame",
  /* social */
  name:"Rockstar Games",handle:"RockstarGames",badge:"blue",follow:true,sub:"GamingLeaksAndRumours",time:"2h",
  likes:"2.4K",retweets:"318",replies:"24",views:"98K",
  avatar:null,media:null,
  avShape:"circle",likeOn:false,audio:"",mediaSrc:"",
  /* per-element visibility — anything false is simply not drawn, and the
     layout closes the gap so you get the space back */
  hidden:{},
  hideCounts:false
};

/* Elements that can be switched off, per platform family.
   [key, label, applies-to test] */
const HIDEABLE=[
  ["avatar",  "Profile picture", ()=>true],
  ["name",    "Display name",    b=>b!=="reddit"],
  ["handle",  "Username",        b=>b==="x"||b==="reddit"||b==="ig"],
  ["badge",   "Verified tick",   b=>b==="x"||b==="fb"||b==="ig"],
  ["time",    "Timestamp",       ()=>true],
  ["menu",    "“…” menu",        b=>b==="x"||b==="fb"||b==="reddit"],
  ["replies", "Replies",         ()=>true],
  ["retweets","Reposts / shares",b=>b==="x"||b==="fb"||b==="ig"],
  ["likes",   "Likes / votes",   ()=>true],
  ["views",   "Views",           b=>b==="x"],
  ["bookmark","Bookmark + share",b=>b==="x"],
  ["actions", "Action row",      b=>b==="fb"||b==="ig"||b==="yt"||b==="reddit"]
];
/* is an element visible? */
function V_ON(key){return !S.hidden[key];}

const $=s=>document.querySelector(s);
const cv=$("#preview"),ctx=cv.getContext("2d");
let lastText=S.text,playing=false,playT0=0,editing=false,viewPinned=false,urlAuto=true;
const isPhone=()=>window.matchMedia("(max-width:900px)").matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function d(){return DESIGNS[S.design];}
function themeKey(){return S.theme==="dark"?"dark":"light";}
function brandPal(){return BRAND[d().brand][themeKey()];}

