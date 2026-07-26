/* data.js — Static data: frame size, typefaces, card themes, outlet list, per-platform palettes and config. */
export const FW=1080,FH=1920;
export const FACES={serif:'"Iowan Old Style",Georgia,"Times New Roman",serif',
  sans:'"Helvetica Neue",Helvetica,Arial,sans-serif',
  mono:'ui-monospace,"SF Mono",Menlo,Consolas,monospace'};
export const SANS=FACES.sans;
export const THEMES={
  light:{card:"#FFFFFF",ink:"#12141A",meta:"#6B7280",rule:"#E3E6EA",shadow:"rgba(0,0,0,.30)",grain:0},
  paper:{card:"#F7F3EC",ink:"#1C1A17",meta:"#7A7266",rule:"#E2DACC",shadow:"rgba(0,0,0,.28)",grain:.055},
  dark :{card:"#15171C",ink:"#F2F4F7",meta:"#8B93A0",rule:"#2C313A",shadow:"rgba(0,0,0,.55)",grain:.03}
};
export const OUTLETS=[
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
  "ig-comment":  {social:true,brand:"ig",post:false},
  "twitch-comment":{social:true,brand:"twitch",post:false}
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
     dark :{bg:"#000000",ink:"#FAFAFA",sub:"#A8A8A8",rule:"#262626",accent:"#0095F6",badge:"#3897F0",like:"#FF3040",rt:"#A8A8A8"}},
  twitch:{light:{bg:"#FFFFFF",ink:"#0E0E10",sub:"#53535F",rule:"#E5E5E8",accent:"#9147FF",badge:"#9147FF",like:"#9147FF",rt:"#53535F"},
     dark :{bg:"#18181B",ink:"#EFEFF1",sub:"#ADADB8",rule:"#2F2F35",accent:"#BF94FF",badge:"#9147FF",like:"#BF94FF",rt:"#ADADB8"}}
};

/* Cheer badge tiers. Below 200k the tile is the tier colour with a dark glyph;
   from 200k up the tile is indigo and the glyph carries the colour. The glyph
   gains points as the tier climbs, matching Twitch's set. */
export const CHEER_INDIGO="#3B2A72";
export const CHEER=[
  ["1",       "1 Bit",         "#CDCDD3",{shape:"tri"}],
  ["100",     "100 Bits",      "#C18CFF",{shape:"diamond"}],
  ["1000",    "1,000 Bits",    "#4FE3B0",{shape:"pent"}],
  ["5000",    "5,000 Bits",    "#48A9FF",{shape:"hex"}],
  ["10000",   "10,000 Bits",   "#FF3A3A",{shape:"star6"}],
  ["25000",   "25,000 Bits",   "#FF74B8",{shape:"star6"}],
  ["50000",   "50,000 Bits",   "#FF9B2E",{shape:"star6"}],
  ["75000",   "75,000 Bits",   "#00C853",{shape:"star6"}],
  ["100000",  "100,000 Bits",  "#FFD400",{shape:"star6"}],
  ["200000",  "200,000 Bits",  "#C9C9D1",{shape:"star8",inv:true}],
  ["300000",  "300,000 Bits",  "#C18CFF",{shape:"star8",inv:true}],
  ["400000",  "400,000 Bits",  "#4FE3B0",{shape:"star8",inv:true}],
  ["500000",  "500,000 Bits",  "#48A9FF",{shape:"star8",inv:true}],
  ["600000",  "600,000 Bits",  "#FF3A3A",{shape:"star8",inv:true}],
  ["700000",  "700,000 Bits",  "#FF74B8",{shape:"star8",inv:true}],
  ["800000",  "800,000 Bits",  "#FF9B2E",{shape:"star8",inv:true}],
  ["900000",  "900,000 Bits",  "#00E15C",{shape:"star8",inv:true}],
  ["1000000", "1,000,000 Bits","#FFD400",{shape:"star8",inv:true}]
];
/* Twitch's default name colours */
export const TWITCH_NAMES=["#FF0000","#0000FF","#008000","#B22222","#FF7F50","#9ACD32",
  "#FF4500","#2E8B57","#DAA520","#D2691E","#5F9EA0","#1E90FF","#FF69B4","#8A2BE2","#00FF7F"];
export const AVCOL=["#1D9BF0","#FF4500","#7B61FF","#00BA7C","#F91880","#FF7A45","#0095F6","#E1306C"];

/* metric fields shown per brand */
export const METRICS={
  x:[["replies","Replies","24"],["retweets","Reposts","318"],["likes","Likes","2.4K"],["views","Views","98K"]],
  reddit:[["likes","Upvotes","3.1K"],["replies","Comments","214"]],
  yt:[["likes","Likes","1.2K"],["replies","Replies","48"]],
  fb:[["likes","Likes","842"],["replies","Comments","96"],["retweets","Shares","23"]],
  ig:[["likes","Likes","5,204"],["replies","Comments","25"],["retweets","Reshares","452"]],
  twitch:[]
};

export const S={
  design:"quote",
  text:"The odds of this happening are millions to one!",
  ranges:[[31,47]],                          /* "millions to one!" */
  outlet:"",url:"",
  theme:"paper",face:"sans",hlColor:"#FFA8C5",hlStyle:"marker",
  header:true,marks:false,width:75,size:42,ypos:0,guides:true,
  crop:"frame",res:"1",bg:"transparent",fps:"30",format:"still",imgFmt:"png",jq:92,exportName:"",
  anim:true,dur:15,fadeEase:"inout",scaleEase:"back",sFrom:88,over:17,drift:0,hold:6,
  bezier:[.34,1.56,.64,1],
  hlAnim:false,hlOffset:9,hlDur:12,
  mode:"type",view:"frame",
  /* social */
  name:"EliteWoofle",handle:"EliteWoffle",badge:"blue",follow:true,sub:"GamingLeaksAndRumours",time:"2h",
  likes:"2.4K",retweets:"318",replies:"24",views:"98K",
  avatar:null,media:null,
  avShape:"circle",likeOn:false,audio:"",mediaSrc:"",
  /* image framing: 100% = exact cover, pan is -100..100 of the available slack */
  avatarScale:100,avatarX:0,avatarY:0,
  mediaScale:100,mediaX:0,mediaY:0,
  /* twitch */
  nameColor:"#00C7AC",cheer:"off",subBadge:true,modBadge:false,twReply:false,
  /* per-element visibility — anything false is simply not drawn, and the
     layout closes the gap so you get the space back */
  hidden:{},
  hideCounts:false
};

/* Elements that can be switched off, per platform family.
   [key, label, applies-to test] */
export const HIDEABLE=[
  ["avatar",  "Profile picture", b=>b!=="twitch"],   /* chat has none */
  ["name",    "Display name",    b=>b!=="reddit"&&b!=="twitch"],
  ["handle",  "Username",        b=>b==="x"||b==="reddit"||b==="ig"||b==="twitch"],
  ["badge",   "Verified tick",   b=>b==="x"||b==="fb"||b==="ig"],
  ["badges",  "Chat badges",     b=>b==="twitch"],
  ["time",    "Timestamp",       ()=>true],
  ["menu",    "“…” menu",        b=>b==="x"||b==="fb"||b==="reddit"],
  ["replies", "Replies",         b=>b!=="twitch"],
  ["retweets","Reposts / shares",b=>b==="x"||b==="fb"||b==="ig"],
  ["likes",   "Likes / votes",   b=>b!=="twitch"],
  ["views",   "Views",           b=>b==="x"],
  ["bookmark","Bookmark + share",b=>b==="x"],
  ["actions", "Action row",      b=>b==="fb"||b==="ig"||b==="yt"||b==="reddit"]
];
/* does this design have any engagement numbers at all? */
export function hasCounts(brand){return brand&&brand!=="twitch";}
/* is an element visible? */
export function V_ON(key){return !S.hidden[key];}

/* Which controls are relevant to the current selection. Anything whose test
   fails is hidden outright, so a card type only ever shows what it can use.
   Each test gets {id, brand, social, post} for the active design. */
export const RELEVANT={
  /* --- account --- */
  nameRow:     x=>x.social&&x.brand!=="reddit"&&x.brand!=="twitch",
  handleRow:   x=>x.social&&x.brand!=="fb",         /* facebook shows a display name only */
  twitchCard:  x=>x.brand==="twitch",
  twReplyRow:  x=>x.brand==="twitch",
  countsRow:   x=>x.social&&hasCounts(x.brand),   /* nothing to blank otherwise */
  subRow:      x=>x.brand==="reddit"||x.id==="x-reply"||(x.brand==="twitch"&&S.twReply),
  audioRow:    x=>x.id==="ig-post",
  badgeRow:    x=>x.social&&x.brand!=="yt"&&x.brand!=="reddit"&&x.brand!=="twitch",
  avShapeRow:  x=>x.brand==="x",
  followRow:   x=>x.id==="fb-post"||x.id==="ig-post",
  likeRow:     x=>x.brand==="x"||x.brand==="ig",    /* only these fill on like */
  avatarDrop:  x=>x.social&&x.brand!=="twitch",   /* chat has no inline avatars */
  /* --- media --- */
  mediaDrop:   x=>["x-post","x-reply","reddit-post","fb-post","ig-post"].indexOf(x.id)>=0,
  mediaSrcRow: x=>x.brand==="x",                    /* only X draws "From <source>" */
  avatarFrame: x=>x.social&&!!S.avatar,             /* no point until there is an image */
  mediaFrame:  x=>!!S.media&&["x-post","x-reply","reddit-post","fb-post","ig-post"].indexOf(x.id)>=0,
  /* --- quote-only --- */
  sourceCard:  x=>!x.social,
  faceWrap:    x=>!x.social,
  headerRow:   x=>!x.social,
  marksRow:    x=>!x.social,
  /* --- social-only --- */
  socialCard:  x=>x.social,
  metricsCard: x=>x.social&&x.brand!=="twitch",
  showCard:    x=>x.social,
  /* --- motion: pointless unless something animates --- */
  timingCap:   x=>S.anim||S.hlAnim,
  durRow:      x=>S.anim,
  holdRow:     x=>S.anim||S.hlAnim,
  curvesGroup: x=>S.anim,
  /* --- export --- */
  fpsRow:      x=>S.format!=="still"                /* a still has no frame rate */
};

export const $=s=>document.querySelector(s);
export const cv=$("#preview"),ctx=cv.getContext("2d");
/* Mutable runtime flags live on one object: ES module imports are read-only
   bindings, so cross-module writes have to go through a property. */
export const R={
  lastText:S.text,   /* last committed textarea value, for range remapping */
  playing:false,     /* preview loop running */
  playT0:0,          /* preview loop start time */
  editing:false,     /* a text field has focus */
  viewPinned:false,  /* user chose the fit mode explicitly */
  urlAuto:true,      /* URL field still auto-filled from the outlet */
  wordSig:null       /* text the tap-to-highlight chips were built from */
};
export const isPhone=()=>window.matchMedia("(max-width:900px)").matches;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function d(){return DESIGNS[S.design];}
export function themeKey(){return S.theme==="dark"?"dark":"light";}
export function brandPal(){return BRAND[d().brand][themeKey()];}

