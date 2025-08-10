// addProtocolの設定
let protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

// マップの初期化
const map = new maplibregl.Map({
    container: 'map',
    style: 'std_1.json',
    // style: 'https://tile2.openstreetmap.jp/styles/osm-bright/style.json',
    center: [134.40267, 34.73987],
    zoom: 14.55,
    minZoom: 1,
    maxZoom: 23,
    pitch: 60,
    maxPitch: 85,
    bearing: 0,
    hash: true,
    attributionControl: false
});

//ジオコーダー（国土地理院 地名検索API）
var geocoder_api = {
    forwardGeocode: async (config) => {
        const features = [];
        const Text_Prefix = config.query.substr(0, 3);
        try {
            let request = 'https://msearch.gsi.go.jp/address-search/AddressSearch?q=' + config.query;
            const response = await fetch(request);
            const geojson = await response.json();

            for (var i = 0; i < geojson.length; i++) {
                if (geojson[i].properties.title.indexOf(Text_Prefix) !== -1) {
                    let point = {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: geojson[i].geometry.coordinates
                        },
                        place_name: geojson[i].properties.title,
                        properties: geojson[i].properties,
                        text: geojson[i].properties.title,
                        place_type: ['place'],
                        center: geojson[i].geometry.coordinates
                    };
                    features.push(point);
                }
            }
        } catch (e) {
            console.error(`Failed to forwardGeocode with error: ${e}`);
        }
        return {
            features: features
        };
    }
};
map.addControl(new MaplibreGeocoder(geocoder_api, { maplibregl: maplibregl }), 'top-right');

// ズーム・回転
map.addControl(new maplibregl.NavigationControl());

// フルスクリーンモードのオンオフ
map.addControl(new maplibregl.FullscreenControl());

// 現在位置表示
map.addControl(new maplibregl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: false
    },
    fitBoundsOptions: { maxZoom: 18 },
    trackUserLocation: true,
    showUserLocation: true
}));

// スケール表示
map.addControl(new maplibregl.ScaleControl({
    maxWidth: 200,
    unit: 'metric'
}));

// Attributionを折りたたみ表示
map.addControl(new maplibregl.AttributionControl({
    compact: true,
    customAttribution: '（<a href="https://twitter.com/shi__works" target="_blank">X(旧Twitter)</a> | <a href="https://github.com/shiwaku/japan-hazard-map-on-maplibre" target="_blank">GitHub</a>） '
}));

// 3D地形コントロール
map.addControl(
    new maplibregl.TerrainControl({
        source: 'aist-dem',
        exaggeration: 1 // 標高を強調する倍率
    })
);

// 人口色分け用のフィルタ準備
let p1 = ["all", [">=", ['to-number', ["get", "PopT"]], 0], ["<", ['to-number', ["get", "PopT"]], 10]];
let p2 = ["all", [">=", ['to-number', ["get", "PopT"]], 10], ["<", ['to-number', ["get", "PopT"]], 20]];
let p3 = ["all", [">=", ['to-number', ["get", "PopT"]], 20], ["<", ['to-number', ["get", "PopT"]], 40]];
let p4 = ["all", [">=", ['to-number', ["get", "PopT"]], 40], ["<", ['to-number', ["get", "PopT"]], 60]];
let p5 = ["all", [">=", ['to-number', ["get", "PopT"]], 60], ["<", ['to-number', ["get", "PopT"]], 80]];
let p6 = ["all", [">=", ['to-number', ["get", "PopT"]], 80], ["<", ['to-number', ["get", "PopT"]], 1000000]];

// 人口色分け用色の準備
let pop_colors = [
    '#0000FF',
    '#00FFFF',
    '#00FF00',
    '#FFBF00',
    '#FF0000',
    '#CB00CB'
]

// マップをロード
map.on("load", () => {
    // 産総研 シームレス標高タイルソース
    map.addSource("aist-dem", {
        "type": "raster-dem",
        "tiles": ["https://gbank.gsj.jp/seamless/elev/terrainRGB/land/{z}/{y}/{x}.png"],
        "attribution": "<a href='https://tiles.gsj.jp/tiles/elev/tiles.html' target='_blank'>産業技術総合研究所 シームレス標高タイル(陸域統合DEM)</a>",
        "tileSize": 256
    });

    // 産総研 シームレス標高タイルセット
    map.setTerrain({ 'source': 'aist-dem', 'exaggeration': 1 });

    // 洪水浸水想定区域（想定最大規模）ソース
    map.addSource("flood_l2_shinsuishin", {
        "type": "raster",
        "tiles": ["https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>"
    });

    // 洪水浸水想定区域（想定最大規模）レイヤ
    map.addLayer({
        "id": "flood_l2_shinsuishin",
        "type": "raster",
        "source": "flood_l2_shinsuishin",
        "minzoom": 0,
        "maxzoom": 23,
        "paint": {
            "raster-opacity": 0.8
        },
        "layout": {
            "visibility": "visible"
        }
    });

    // 洪水浸水想定区域（計画規模（現在の凡例））ソース
    map.addSource("flood_l1_shinsuishin", {
        "type": "raster",
        "tiles": ["https://disaportaldata.gsi.go.jp/raster/01_flood_l1_shinsuishin_newlegend_data/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>"
    });

    // 洪水浸水想定区域（計画規模（現在の凡例））レイヤ
    map.addLayer({
        "id": "flood_l1_shinsuishin",
        "type": "raster",
        "source": "flood_l1_shinsuishin",
        "minzoom": 0,
        "maxzoom": 23,
        "paint": {
            "raster-opacity": 0.8
        },
        "layout": {
            "visibility": "none"
        }
    });

    // 浸水継続時間（想定最大規模）ソース
    map.addSource("flood_l2_keizoku", {
        "type": "raster",
        "tiles": ["https://disaportaldata.gsi.go.jp/raster/01_flood_l2_keizoku_data/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>"
    });

    // 浸水継続時間（想定最大規模）レイヤ
    map.addLayer({
        "id": "flood_l2_keizoku",
        "type": "raster",
        "source": "flood_l2_keizoku",
        "minzoom": 0,
        "maxzoom": 23,
        "paint": {
            "raster-opacity": 0.8
        },
        "layout": {
            "visibility": "none"
        }
    });

    // 家屋倒壊等氾濫想定区域（氾濫流）ソース
    map.addSource("flood_l2_kaokutoukai_hanran", {
        "type": "raster",
        "tiles": ["https://disaportaldata.gsi.go.jp/raster/01_flood_l2_kaokutoukai_hanran_data/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>"
    });

    // 家屋倒壊等氾濫想定区域（氾濫流）レイヤ
    map.addLayer({
        "id": "flood_l2_kaokutoukai_hanran",
        "type": "raster",
        "source": "flood_l2_kaokutoukai_hanran",
        "minzoom": 0,
        "maxzoom": 23,
        "paint": {
            "raster-opacity": 0.8
        },
        "layout": {
            "visibility": "none"
        }
    });

    // 	家屋倒壊等氾濫想定区域（河岸侵食）ソース
    map.addSource("flood_l2_kaokutoukai_kagan", {
        "type": "raster",
        "tiles": ["https://disaportaldata.gsi.go.jp/raster/01_flood_l2_kaokutoukai_kagan_data/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>"
    });

    // 家屋倒壊等氾濫想定区域（河岸侵食）レイヤ
    map.addLayer({
        "id": "flood_l2_kaokutoukai_kagan",
        "type": "raster",
        "source": "flood_l2_kaokutoukai_kagan",
        "minzoom": 0,
        "maxzoom": 23,
        "paint": {
            "raster-opacity": 0.8
        },
        "layout": {
            "visibility": "none"
        }
    });

    // 	土砂災害警戒区域（土石流）ソース
    map.addSource("dosekiryukeikaikuiki", {
        "type": "raster",
        "tiles": ["https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>"
    });

    // 土砂災害警戒区域（土石流）レイヤ
    map.addLayer({
        "id": "dosekiryukeikaikuiki",
        "type": "raster",
        "source": "dosekiryukeikaikuiki",
        "minzoom": 0,
        "maxzoom": 23,
        "paint": {
            "raster-opacity": 0.8
        },
        "layout": {
            "visibility": "none"
        }
    });

    // 土砂災害警戒区域（急傾斜地の崩壊）ソース
    map.addSource("kyukeishakeikaikuiki", {
        "type": "raster",
        "tiles": ["https://disaportaldata.gsi.go.jp/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>"
    });

    // 土砂災害警戒区域（急傾斜地の崩壊）レイヤ
    map.addLayer({
        "id": "kyukeishakeikaikuiki",
        "type": "raster",
        "source": "kyukeishakeikaikuiki",
        "minzoom": 0,
        "maxzoom": 23,
        "paint": {
            "raster-opacity": 0.8
        },
        "layout": {
            "visibility": "none"
        }
    });

    // 土砂災害警戒区域（地すべり）ソース
    map.addSource("jisuberikeikaikuiki", {
        "type": "raster",
        "tiles": ["https://disaportaldata.gsi.go.jp/raster/05_jisuberikeikaikuiki/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>"
    });

    // 土砂災害警戒区域（地すべり）レイヤ
    map.addLayer({
        "id": "jisuberikeikaikuiki",
        "type": "raster",
        "source": "jisuberikeikaikuiki",
        "minzoom": 0,
        "maxzoom": 23,
        "paint": {
            "raster-opacity": 0.8
        },
        "layout": {
            "visibility": "none"
        }
    });

    // 土石流危険渓流ソース
    map.addSource("dosekiryukikenkeiryu", {
        "type": "raster",
        "tiles": ["https://disaportaldata.gsi.go.jp/raster/05_dosekiryukikenkeiryu/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>"
    });

    // 土石流危険渓流レイヤ
    map.addLayer({
        "id": "dosekiryukikenkeiryu",
        "type": "raster",
        "source": "dosekiryukikenkeiryu",
        "minzoom": 0,
        "maxzoom": 23,
        "paint": {
            "raster-opacity": 0.8
        },
        "layout": {
            "visibility": "none"
        }
    });

    // 急傾斜地崩壊危険箇所ソース
    map.addSource("kyukeisyachihoukai", {
        "type": "raster",
        "tiles": ["https://disaportaldata.gsi.go.jp/raster/05_kyukeisyachihoukai/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>"
    });

    // 急傾斜地崩壊危険箇所レイヤ
    map.addLayer({
        "id": "kyukeisyachihoukai",
        "type": "raster",
        "source": "kyukeisyachihoukai",
        "minzoom": 0,
        "maxzoom": 23,
        "paint": {
            "raster-opacity": 0.8
        },
        "layout": {
            "visibility": "none"
        }
    });

    // 地すべり危険箇所ソース
    map.addSource("jisuberikikenkasyo", {
        "type": "raster",
        "tiles": ["https://disaportaldata.gsi.go.jp/raster/05_jisuberikikenkasyo/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>"
    });

    // 地すべり危険箇所レイヤ
    map.addLayer({
        "id": "jisuberikikenkasyo",
        "type": "raster",
        "source": "jisuberikikenkasyo",
        "minzoom": 0,
        "maxzoom": 23,
        "paint": {
            "raster-opacity": 0.8
        },
        "layout": {
            "visibility": "none"
        }
    });

    // 雪崩危険箇所ソース
    map.addSource("nadarekikenkasyo", {
        "type": "raster",
        "tiles": ["https://disaportaldata.gsi.go.jp/raster/05_nadarekikenkasyo/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>"
    });

    // 雪崩危険箇所レイヤ
    map.addLayer({
        "id": "nadarekikenkasyo",
        "type": "raster",
        "source": "nadarekikenkasyo",
        "minzoom": 0,
        "maxzoom": 23,
        "paint": {
            "raster-opacity": 0.8
        },
        "layout": {
            "visibility": "none"
        }
    });

    // 高潮浸水想定区域ソース
    map.addSource("hightide_l2_shinsuishin", {
        "type": "raster",
        "tiles": ["https://disaportaldata.gsi.go.jp/raster/03_hightide_l2_shinsuishin_data/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>"
    });

    // 高潮浸水想定区域レイヤ
    map.addLayer({
        "id": "hightide_l2_shinsuishin",
        "type": "raster",
        "source": "hightide_l2_shinsuishin",
        "minzoom": 0,
        "maxzoom": 23,
        "paint": {
            "raster-opacity": 0.8
        },
        "layout": {
            "visibility": "none"
        }
    });

    // 津波浸水想定ソース
    map.addSource("tsunami_newlegend", {
        "type": "raster",
        "tiles": ["https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>"
    });

    // 津波浸水想定レイヤ
    map.addLayer({
        "id": "tsunami_newlegend",
        "type": "raster",
        "source": "tsunami_newlegend",
        "minzoom": 0,
        "maxzoom": 23,
        "paint": {
            "raster-opacity": 0.8
        },
        "layout": {
            "visibility": "none"
        }
    });

    // 内水（雨水出水）浸水想定区域ソース
    map.addSource("naisui_data", {
        "type": "raster",
        "tiles": ["https://disaportaldata.gsi.go.jp/raster/02_naisui_data/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "<a href='https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html' target='_blank'>ハザードマップポータルサイト</a>"
    });

    // 内水（雨水出水）浸水想定区域レイヤ
    map.addLayer({
        "id": "naisui_data",
        "type": "raster",
        "source": "naisui_data",
        "minzoom": 0,
        "maxzoom": 23,
        "paint": {
            "raster-opacity": 0.8
        },
        "layout": {
            "visibility": "none"
        }
    });

    // PLATEAU建物（PMTiles）ソース
    map.addSource("plateau-pmtiles", {
        type: "vector",
        url: "pmtiles://https://shiworks.xsrv.jp/pmtiles-data/plateau/PLATEAU_2022_LOD1.pmtiles",
        minzoom: 16,
        maxzoom: 16,
        attribution: '<a href="https://www.geospatial.jp/ckan/dataset/plateau">3D都市モデルPLATEAU建物データ（国土交通省）</a>'
    });

    // PLATEAU建物（PMTiles）レイヤ
    map.addLayer({
        'id': 'plateau-pmtiles',
        'source': 'plateau-pmtiles',
        'source-layer': "PLATEAU",
        "minzoom": 14,
        "maxzoom": 23,
        'type': 'fill-extrusion',
        'paint': {
            "fill-extrusion-color": '#FFFFFF',
            "fill-extrusion-opacity": 1,
            "fill-extrusion-height": ["get", "measuredHeight"]
        }
    });

    // 令和2年簡易100mメッシュ人口（全国）ソース
    map.addSource("100m_mesh_pop2020", {
        "type": "vector",
        "url": "pmtiles://https://xs489works.xsrv.jp/pmtiles-data/100m_mesh_pop2020/100m_mesh_pop2020_v2.pmtiles",
        "attribution": '<a href="https://gtfs-gis.jp/teikyo/index.html" target="_blank">地域・交通データ研究所 簡易100mメッシュ人口データ(2020年国勢調査ベース)</a>',
    });

    // 令和2年簡易100mメッシュ人口（全国）レイヤ
    map.addLayer({
        "id": "100m_mesh_pop2020_fill",
        "type": "fill",
        "source": "100m_mesh_pop2020",
        "source-layer": "100m_mesh_pop2020fgb",
        "minzoom": 12,
        "maxzoom": 23,
        "layout": {
            "visibility": "none"
        },
        "paint": {
            "fill-color": [
                "case",
                p1, pop_colors[0],
                p2, pop_colors[1],
                p3, pop_colors[2],
                p4, pop_colors[3],
                p5, pop_colors[4],
                p6, pop_colors[5],
                pop_colors[5]
            ],
            "fill-opacity": 0.5,
            "fill-outline-color": "rgba(0,0,0,0)"
        }
    });

    // 指定緊急避難場所ソース
    map.addSource("hinanbasho", {
        "type": "vector",
        "url": "pmtiles://https://xs489works.xsrv.jp/pmtiles-data/gsi/hinanbasho/hinanbasho_20240129.pmtiles",
        "attribution": "<a href='https://www.gsi.go.jp/bousaichiri/hinanbasho.html'>指定緊急避難場所データ（国土地理院Webサイト）を加工して作成</a>"
    });

    // PNGソース
    map.loadImage('./img/location-pin.png',
        function (error, image) {
            if (error) throw error;
            map.addImage('location-pin-1', image);
        }
    );

    // 指定緊急避難場所シンボルレイヤ
    map.addLayer({
        "id": "hinanbasho",
        "source": "hinanbasho",
        "source-layer": "hinanbasho_20240129",
        "minzoom": 12,
        "maxzoom": 23,
        "type": "symbol",
        "layout": {
            "icon-image": "location-pin-1",
            "icon-size": 0.5,
            "icon-allow-overlap": true, // シンボルの重なりを許可
        }
    });

    // フィルタ設定（洪水で絞り込み）
    map.setFilter('hinanbasho', ['==', '洪水', '1']);

    // 自然災害伝承碑ソース
    map.addSource('denshouhi', {
        "type": "geojson",
        "data": "https://xs489works.xsrv.jp/pmtiles-data/gsi/denshouhi/20240125.geojson",
        "attribution": "<a href='https://www.gsi.go.jp/bousaichiri/denshouhi_datainfo.html'>自然災害伝承碑データ（国土地理院Webサイト）</a>"
    });

    // PNGソース
    map.loadImage('./img/location-pin2_red.png', // location-pinアイコンのURLを指定
        function (error, image) {
            if (error) throw error;
            map.addImage('location-pin-2', image); // 'location-pin'という名前でアイコンを追加
        }
    );

    // 自然災害伝承碑シンボルレイヤ
    map.addLayer({
        'id': 'denshouhi',
        "type": "symbol",
        'source': 'denshouhi',
        "minzoom": 9,
        "maxzoom": 23,
        "layout": {
            "icon-image": "location-pin-2",
            "icon-size": 0.5,
            "icon-allow-overlap": true, // シンボルの重なりを許可
        }
    });

    // スライダーでPNGタイルの不透明度を制御
    const sliderOpactiy = document.getElementById('slider-opacity');
    const sliderOpactiyValue = document.getElementById('slider-opacity-value');

    sliderOpactiy.addEventListener('input', (e) => {
        map.setPaintProperty(
            'flood_l2_shinsuishin',
            'raster-opacity',
            parseInt(e.target.value, 10) / 100
        );
        sliderOpactiyValue.textContent = e.target.value + '%';
    });

});

// ============================== レイヤの表示・非表示切り替え制御 ==============================

// ラジオボタン要素を取得
var radios = document.querySelectorAll('input[type=radio][name="layer"]');

// 各ラジオボタンにイベントリスナーを設定
radios.forEach(radio => {
    radio.addEventListener('change', function () {
        switchLayer(this.value);
        switchLegend(this.value);
    });
});

// ---------- 追加：安全にフィルタをかけるヘルパー ----------
function setHinanbashoFilterSafe(expr) {
    if (map.getLayer('hinanbasho')) {
        map.setFilter('hinanbasho', expr);
    } else {
        // まだレイヤが無ければ、描画がアイドルになった後に一度だけ適用
        map.once('idle', () => {
            if (map.getLayer('hinanbasho')) map.setFilter('hinanbasho', expr);
        });
    }
}


// レイヤーを切り替える関数
function switchLayer(layerId) {
    var layerIds = ['flood_l2_shinsuishin', 'flood_l1_shinsuishin', 'flood_l2_keizoku',
        'flood_l2_kaokutoukai_hanran', 'flood_l2_kaokutoukai_kagan', 'dosekiryukeikaikuiki',
        'kyukeishakeikaikuiki', 'jisuberikeikaikuiki', 'dosekiryukikenkeiryu',
        'kyukeisyachihoukai', 'jisuberikikenkasyo', 'nadarekikenkasyo',
        'hightide_l2_shinsuishin', 'tsunami_newlegend', 'naisui_data'];

    layerIds.forEach(function (id) {
        var visibility = (id === layerId) ? 'visible' : 'none';
        map.setLayoutProperty(id, 'visibility', visibility);
    });

    // 指定緊急避難場所シンボルレイヤ フィルタ設定
    if (layerId == 'flood_l2_shinsuishin' || layerId == 'flood_l1_shinsuishin' || layerId == 'flood_l2_keizoku' || layerId == 'flood_l2_kaokutoukai_hanran' || layerId == 'flood_l2_kaokutoukai_kagan') {
        map.setFilter('hinanbasho', ['==', '洪水', '1']);
    } else if (layerId == 'dosekiryukeikaikuiki' || layerId == 'kyukeishakeikaikuiki' || layerId == 'jisuberikeikaikuiki' || layerId == 'dosekiryukikenkeiryu' || layerId == 'kyukeisyachihoukai' || layerId == 'jisuberikikenkasyo' || layerId == 'nadarekikenkasyo') {
        map.setFilter('hinanbasho', ['==', '崖崩れ、土石流及び地滑り', '1']);
    } else if (layerId == 'hightide_l2_shinsuishin') {
        map.setFilter('hinanbasho', ['==', '高潮', '1']);
    } else if (layerId == 'tsunami_newlegend') {
        map.setFilter('hinanbasho', ['==', '津波', '1']);
    } else if (layerId == 'naisui_data') {
        map.setFilter('hinanbasho', ['==', '内水', '1']);
    }

    // スライダーでPNGタイルの不透明度を制御
    const sliderOpactiy = document.getElementById('slider-opacity');
    const sliderOpactiyValue = document.getElementById('slider-opacity-value');

    // 不透明度の初期設定
    map.setPaintProperty(
        layerId,
        'raster-opacity',
        0.8
    );

    sliderOpactiyValue.textContent = '80%';
    sliderOpactiy.value = "80";

    sliderOpactiy.addEventListener('input', (e) => {
        map.setPaintProperty(
            layerId,
            'raster-opacity',
            parseInt(e.target.value, 10) / 100
        );
        sliderOpactiyValue.textContent = e.target.value + '%';
    });
}

// 凡例を切り替える関数
function switchLegend(layerId) {
    var legends = {
        'flood_l2_shinsuishin': document.getElementById('legend-flood_l2_shinsuishin'),
        'flood_l1_shinsuishin': document.getElementById('legend-flood_l1_shinsuishin'),
        'flood_l2_keizoku': document.getElementById('legend-flood_l2_keizoku'),
        'flood_l2_kaokutoukai_hanran': document.getElementById('legend-flood_l2_kaokutoukai_hanran'),
        'flood_l2_kaokutoukai_kagan': document.getElementById('legend-flood_l2_kaokutoukai_kagan'),
        'dosekiryukeikaikuiki': document.getElementById('legend-dosekiryukeikaikuiki'),
        'kyukeishakeikaikuiki': document.getElementById('legend-kyukeishakeikaikuiki'),
        'jisuberikeikaikuiki': document.getElementById('legend-jisuberikeikaikuiki'),
        'dosekiryukikenkeiryu': document.getElementById('legend-dosekiryukikenkeiryu'),
        'kyukeisyachihoukai': document.getElementById('legend-kyukeisyachihoukai'),
        'jisuberikikenkasyo': document.getElementById('legend-jisuberikikenkasyo'),
        'nadarekikenkasyo': document.getElementById('legend-nadarekikenkasyo'),
        'hightide_l2_shinsuishin': document.getElementById('legend-hightide_l2_shinsuishin'),
        'tsunami_newlegend': document.getElementById('legend-tsunami_newlegend'),
        'naisui_data': document.getElementById('legend-naisui_data'),
    };

    for (var key in legends) {
        legends[key].style.display = (key === layerId) ? 'block' : 'none';
    }
}

// 簡易100mメッシュ人口の表示・非表示切り替え制御
document.getElementById('pop-map').addEventListener('change', function (e) {
    var legend = document.getElementById('legend-pop');
    if (e.target.checked) {
        // チェックボックスがON - レイヤーと凡例を表示
        map.setLayoutProperty('100m_mesh_pop2020_fill', 'visibility', 'visible');
        legend.style.display = 'block';
    } else {
        // チェックボックスがOFF - レイヤーと凡例を非表示
        map.setLayoutProperty('100m_mesh_pop2020_fill', 'visibility', 'none');
        legend.style.display = 'none';
    }
});

/*
// ============================== ポップアップ表示 ==============================

// 指定緊急避難場所ポップアップ表示
map.on('click', 'hinanbasho', (e) => {
    var lng = e.features[0].geometry.coordinates[0];
    var lat = e.features[0].geometry.coordinates[1];
    var jusho = e.features[0].properties['住所'];
    var shisetsumei = e.features[0].properties['施設・場所名'];
    var chofuku = e.features[0].properties['指定避難所との住所同一'];

    var SyubetuIds = ["洪水", "崖崩れ、土石流及び地滑り", "高潮", "津波", "大規模な火事", "内水氾濫", "火山現象"];
    var SyubetuMei = ''
    for (var j = 0; j < SyubetuIds.length; j++) {
        if (e.features[0].properties[SyubetuIds[j]] === '1') {
            SyubetuMei += SyubetuIds[j] + "　"
        }
    }

    var res_chofuku = '';
    if (chofuku === '1') {
        res_chofuku = "〇";
    } else {
        res_chofuku = "-";
    }

    new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(
            '<b>' + '<big>' + '<font color="#009800">' + shisetsumei + '</font>' + '</big>' + '</b>' + '<br>'
            + '住所: ' + jusho + '<br>'
            + '<a href=\https://www.google.com/maps?q=' + lat + "," + lng + "&hl=ja' target='_blank'>🌎Google Maps</a>"
            + '<br><br>'
            + '<b>' + '<big>' + '対応している災害の種別' + '</big>' + '</b>' + '<br>' + SyubetuMei + '<br><br>'
            + '指定避難所との住所同一: ' + res_chofuku + '<br><br>'
            + '<b>' + '※最新かつ詳細の状況などは必ず当該市町村にご確認ください。' + '</b>' + '<br>'
            + '<a href=https://www.gsi.go.jp/bousaichiri/hinanbasho.html>「指定緊急避難場所」について</a>')
        .addTo(map);

});

// 画像が存在するかどうかを確認する関数
async function checkImage(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

// 自然災害伝承碑ポップアップ表示
map.on('click', 'denshouhi', async (e) => {
    var lng = e.features[0].geometry.coordinates[0];
    var lat = e.features[0].geometry.coordinates[1];
    var id = e.features[0].properties['ID'];
    var himei = e.features[0].properties['碑名'];
    var konryunen = e.features[0].properties['建立年'];
    var shozaichi = e.features[0].properties['所在地'];
    var saigaimei = e.features[0].properties['災害名'];
    var saigaishubetsu = e.features[0].properties['災害種別'];
    var denshonaiyo = e.features[0].properties['伝承内容'];

    // 画像のURL（.jpgと.JPGの両方を試す）
    let imgURL_jpg = "https://maps.gsi.go.jp/legend/disaster_lore/" + id.substring(0, 5) + "/" + id + ".jpg";
    let imgURL_JPG = "https://maps.gsi.go.jp/legend/disaster_lore/" + id.substring(0, 5) + "/" + id + ".JPG";

    // どちらの画像が存在するかを確認
    let imgURL = await checkImage(imgURL_jpg) ? imgURL_jpg :
        await checkImage(imgURL_JPG) ? imgURL_JPG :
            '';  // どちらの画像も存在しない場合は空の文字列を使用

    new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(
            '<div style="border-bottom:1px solid #000; font-size: 1.2em; color: red;"><strong>碑名: ' + himei + '</strong></div>' +
            '<div style="border-bottom:1px solid #000;">建立年: ' + konryunen + '</div>' +
            '<div style="border-bottom:1px solid #000;">所在地: ' + shozaichi + '</div>' +
            '<div style="border-bottom:1px solid #000;">災害名: ' + saigaimei + '</div>' +
            '<div style="border-bottom:1px solid #000;">災害種別: ' + saigaishubetsu + '</div>' +
            '<div style="border-bottom:1px solid #000;">伝承内容: ' + denshonaiyo + '</div>' +
            '<div><a href="' + imgURL + '" target="_blank"><img src="' + imgURL + '" alt="画像" style="width: 100%; height: auto;"></a></div>' +
            '<div style="border-bottom:1px solid #000;">ID: ' + id + '</div>' +
            '<div><a href="https://www.google.com/maps?q=' + lat + ',' + lng + '&hl=ja" target="_blank">🌎Google Maps</a></div>'
        )
        .addTo(map);
});

// PNGタイルからRGB値を取得
// 【参考1】https://gsj-seamless.jp/labs/datapng/gridpngtile.html
// 【参考2】https://gsj-seamless.jp/labs/datapng/sample/leaflet_shinsuishin1.html

/// ****************
// latLngToTile 緯度経度をタイル座標に変換する関数
//  latLng: 緯度経度オブジェクト（lat,lngフィールドを持ちます）
//  z: ズームレベル
//  戻り値: タイル座標オブジェクト（x, yフィールドを持ちます)
//    ※通常，地図ライブラリ内に同様の関数が用意されています．
/// ****************

function latLngToTile(lat, lng, z) {
    const
        w = Math.pow(2, (z === undefined) ? 0 : z) / 2,		// 世界全体のピクセル幅
        yrad = Math.log(Math.tan(Math.PI * (90 + lat) / 360));

    return { x: (lng / 180 + 1) * w, y: (1 - yrad / Math.PI) * w };
};

/// ****************
// getLegendItem 凡例情報，タイルURL，座標，ズームレベルを指定して凡例項目を取得する関数
//  legend: 凡例情報オブジェクト．r,g,b,titleを持つ凡例項目オブジェクトの配列
//	url: タイル画像のURLテンプレート．
//		ズームレベル，X, Y座標をそれぞれ{z},{x},{y}として埋め込む
//	ll: 緯度経度オブジェクト（lat,lngフィールドを持ちます）
//  z:　ズームレベル
//  invalid: 追加無効値を相当する数値で指定．デフォルトは指定なし
//  戻り値: 成功時に凡例項目オブジェクトを受け取るプロミス．該当するものがない場合はnullを受け取ります
/// ****************

function getLegendItem(legend, url, lat, lng, z, invalid = undefined) {
    return new Promise(function (resolve, reject) {
        const
            p = latLngToTile(lat, lng, z),
            x = Math.floor(p.x),			// タイルX座標
            y = Math.floor(p.y),			// タイルY座標
            i = (p.x - x) * 256,			// タイル内i座標
            j = (p.y - y) * 256,			// タイル内j座標
            img = new Image();

        img.crossOrigin = 'anonymous';	// 画像ファイルからデータを取り出すために必要です
        img.onload = function () {
            const
                canvas = document.createElement('canvas'),
                context = canvas.getContext('2d');
            let
                v,
                d;

            canvas.width = 1;
            canvas.height = 1;
            context.drawImage(img, i, j, 1, 1, 0, 0, 1, 1);
            d = context.getImageData(0, 0, 1, 1).data;
            if (d[3] !== 255) {
                v = null;
            } else {
                v = legend.find(o => o.r == d[0] && o.g == d[1] && o.b == d[2])
                //console.log("RGB:" + "R:" + o.r + "G:" + o.g + "B:" + o.b)
                // console.log("RGB:" + "R:" + v.r + "G:" + v.g + "B:" + v.b)
                // console.log("凡例情報:" + v.title)
            }
            resolve(v);
        }
        img.onerror = function () {
            resolve(null);
        }
        img.src = url.replace('{z}', z).replace('{y}', y).replace('{x}', x);
        // console.log("img.src:" + img.src)
    });
};

// 凡例情報セット

// 洪水浸水想定区域（想定最大規模）、洪水浸水想定区域（計画規模（現在の凡例））
const legend_shinsuishin = [
    { r: 247, g: 245, b: 169, title: '0.5m未満' },
    { r: 255, g: 216, b: 192, title: '0.5～3.0m' },
    { r: 255, g: 183, b: 183, title: '3.0～5.0m' },
    { r: 255, g: 145, b: 145, title: '5.0～10.0m' },
    { r: 242, g: 133, b: 201, title: '10.0～20.0m' },
    { r: 220, g: 122, b: 220, title: '20.0m以上' }
];

// 浸水継続時間（想定最大規模）
const legend_keizoku = [
    { r: 160, g: 210, b: 255, title: '12時間未満' },
    { r: 0, g: 65, b: 255, title: '12時間 ～ 1日未満' },
    { r: 250, g: 245, b: 0, title: '1日 ～ 3日未満' },
    { r: 255, g: 153, b: 0, title: '3日 ～ 1週間未満' },
    { r: 255, g: 40, b: 0, title: '1週間 ～ 2週間未満' },
    { r: 180, g: 0, b: 104, title: '2週間 ～ 4週間未満' },
    { r: 96, g: 0, b: 96, title: '4週間以上' },
];

// 高潮浸水想定区域、津波浸水想定
const legend_hightide_tsunami = [
    { r: 255, g: 255, b: 179, title: '0.3m未満' },
    { r: 247, g: 245, b: 169, title: '0.3～0.5m' },
    { r: 248, g: 225, b: 166, title: '0.5～1.0m' },
    { r: 255, g: 216, b: 192, title: '1.0～3.0m' },
    { r: 255, g: 183, b: 183, title: '3.0～5.0m' },
    { r: 255, g: 145, b: 145, title: '5.0～10.0m' },
    { r: 242, g: 133, b: 201, title: '10.0～20.0m' },
    { r: 220, g: 122, b: 188, title: '20.0m以上' }
];

// 浸水深ポップアップ表示
map.on('click', function (e) {
    // 表示されているレイヤーのIDを格納する配列
    var rasterLayerIds = [];
    const mapLayers = map.getStyle().layers;

    // 全てのレイヤーを走査して、'type'が'raster'かつ'visibility'が'visible'のものをフィルタリング
    mapLayers.forEach(layer => {
        const visibility = map.getLayoutProperty(layer.id, 'visibility');
        // レイヤーのtypeプロパティを取得
        const type = layer.type;
        if (visibility === 'visible' && type === 'raster') {
            rasterLayerIds.push(layer.id);
        }
    });

    console.log('表示されているレイヤー: ' + rasterLayerIds);

    // ラスタレイヤのidからポップアップ表示に使用するURLを生成
    let RasterTileUrl = '';
    let legend = [];
    if (rasterLayerIds == 'flood_l2_shinsuishin') {
        // 洪水浸水想定区域（想定最大規模）
        RasterTileUrl = 'https://disaportaldata.gsi.go.jp/raster/01_' + rasterLayerIds + '/{z}/{x}/{y}.png';
        legend = legend_shinsuishin;
    } else if (rasterLayerIds == 'flood_l1_shinsuishin') {
        // 洪水浸水想定区域（計画規模（現在の凡例））
        RasterTileUrl = 'https://disaportaldata.gsi.go.jp/raster/01_' + rasterLayerIds + '_newlegend_data/{z}/{x}/{y}.png';
        legend = legend_shinsuishin;
    } else if (rasterLayerIds == 'flood_l2_keizoku') {
        // 浸水継続時間（想定最大規模）
        RasterTileUrl = 'https://disaportaldata.gsi.go.jp/raster/01_' + rasterLayerIds + '_data/{z}/{x}/{y}.png';
        legend = legend_keizoku;
    } else if (rasterLayerIds == 'hightide_l2_shinsuishin') {
        // 高潮浸水想定区域
        RasterTileUrl = 'https://disaportaldata.gsi.go.jp/raster/03_' + rasterLayerIds + '_data/{z}/{x}/{y}.png';
        legend = legend_hightide_tsunami;
    } else if (rasterLayerIds == 'tsunami_newlegend') {
        // 津波浸水想定
        RasterTileUrl = 'https://disaportaldata.gsi.go.jp/raster/04_' + rasterLayerIds + '_data/{z}/{x}/{y}.png';
        legend = legend_hightide_tsunami;
    }

    if (RasterTileUrl != '') {
        // 現在表示されているラスタレイヤをもとにポップアップ表示
        // クリックしたレイヤ名を取得
        // クリックしたピクセル座標にあるすべてのフィーチャを取得する
        var features = map.queryRenderedFeatures(e.point);

        // クリックしたピクセル座標にあるレイヤ名を取得する
        var clickedLayerNames = features.map(function (feature) {
            return feature.layer.id;
        });

        // クリックしたピクセル座標にあるすべてのレイヤの名前を出力する
        console.log('Clicked layers:', clickedLayerNames);
        if (clickedLayerNames.indexOf('hinanbasho') === -1 && clickedLayerNames.indexOf('denshouhi') === -1 && clickedLayerNames.indexOf('100m_mesh_pop2020_fill') === -1) {
            // ポップアップ表示
            const lng = e.lngLat.lng;
            const lat = e.lngLat.lat;
            getLegendItem(legend, RasterTileUrl, lat, lng, Math.trunc(map.getZoom())).then(function (v) {
                let s = '';
                let res = (v ? v.title : '取得できません');
                if (rasterLayerIds == 'flood_l2_shinsuishin') {
                    s = '<p>' + '洪水によって想定される浸水深' + '<br>' + '<b>' + res + '</b>' + '<br>' + '<a href=\https://www.google.com/maps?q=' + lat + "," + lng + "&hl=ja' target='_blank'>🌎Google Maps</a>" + '</p>';
                } else if (rasterLayerIds == 'flood_l1_shinsuishin') {
                    s = '<p>' + '洪水によって想定される浸水深' + '<br>' + '<b>' + res + '</b>' + '<br>' + '<a href=\https://www.google.com/maps?q=' + lat + "," + lng + "&hl=ja' target='_blank'>🌎Google Maps</a>" + '</p>';
                } else if (rasterLayerIds == 'flood_l2_keizoku') {
                    s = '<p>' + '浸水継続時間（想定最大規模）' + '<br>' + '<b>' + res + '</b>' + '<br>' + '<a href=\https://www.google.com/maps?q=' + lat + "," + lng + "&hl=ja' target='_blank'>🌎Google Maps</a>" + '</p>';
                } else if (rasterLayerIds == 'hightide_l2_shinsuishin') {
                    s = '<p>' + '高潮によって想定される浸水深' + '<br>' + '<b>' + res + '</b>' + '<br>' + '<a href=\https://www.google.com/maps?q=' + lat + "," + lng + "&hl=ja' target='_blank'>🌎Google Maps</a>" + '</p>';
                } else if (rasterLayerIds == 'tsunami_newlegend') {
                    s = '<p>' + '津波によって想定される浸水深' + '<br>' + '<b>' + res + '</b>' + '<br>' + '<a href=\https://www.google.com/maps?q=' + lat + "," + lng + "&hl=ja' target='_blank'>🌎Google Maps</a>" + '</p>';
                }
                new maplibregl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(s)
                    .addTo(map);
            });
        }
    }
});

// クリック時のポップアップ表示
map.on('click', '100m_mesh_pop2020_fill', (e) => {
    var coordinates = e.features[0].geometry.coordinates[0]; // ポリゴンの頂点の配列
    var lngSum = 0, latSum = 0;

    coordinates.forEach(coord => {
        lngSum += coord[0]; // 経度の合計
        latSum += coord[1]; // 緯度の合計
    });

    var lng = lngSum / coordinates.length; // 経度の平均
    var lat = latSum / coordinates.length; // 緯度の平均

    var MESH_CODE = e.features[0].properties['MESH_CODE'];
    var PopT = e.features[0].properties['PopT'];
    var Pop0_14 = e.features[0].properties['Pop0_14'];
    var Pop15_64 = e.features[0].properties['Pop15_64'];
    var Pop65over = e.features[0].properties['Pop65over'];
    var Pop75over = e.features[0].properties['Pop75over'];
    var Pop85over = e.features[0].properties['Pop85over'];

    new maplibregl.Popup({ className: 'custom-100m-mesh-pop2020-popup' })
        .setLngLat(e.lngLat)
        .setHTML(
            '<div style="font-size: 1.2em; color: #0065CB;"><strong>簡易100mメッシュ人口</strong></div>' +
            '<div style="font-size: 1.2em; color: #0065CB;"><strong>(2020年国勢調査ベース)</strong></div>' +
            '<table class="pop-info">' +
            '<tr>' +
            '<th></th>' +
            '<th></th>' +
            '</tr>' +
            '<tr>' +
            '<td>メッシュコード：</td>' +
            '<td><b>' + MESH_CODE + '</b></td>' +
            '</tr>' +
            '<tr>' +
            '<td>総人口：</td>' +
            '<td><b>' + PopT + '人' + '</b></td>' +
            '</tr>' +
            '<tr>' +
            '<td>0～14歳人口：</td>' +
            '<td><b>' + Pop0_14 + '人' + '</b></td>' +
            '</tr>' +
            '<tr>' +
            '<td>15～64歳人口：</td>' +
            '<td><b>' + Pop15_64 + '人' + '</b></td>' +
            '</tr>' +
            '<tr>' +
            '<td>65歳以上人口：</td>' +
            '<td><b>' + Pop65over + '人' + '</b></td>' +
            '</tr>' +
            '<tr>' +
            '<td>75歳以上人口：</td>' +
            '<td><b>' + Pop75over + '人' + '</b></td>' +
            '</tr>' +
            '<tr>' +
            '<td>85歳以上人口：</td>' +
            '<td><b>' + Pop85over + '人' + '</b></td>' +
            '</tr>' +
            '</table>' +
            '※このデータは、簡易な方法で人口を按分したものであり、当該100mメッシュの実際の人口を示しているものではありません。' + '<br>' +
            '<a href=\https://www.google.com/maps?q=' + lat + "," + lng + "&hl=ja' target='_blank'>🌎Google Maps</a>" + ' ' +
            '<a href=\https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + lat + "," + lng + "&hl=ja' target='_blank'>📷Street View</a>"
        )
        .addTo(map);
});
*/

// ============================== 避難場所までの避難経路の表示 ==============================

// 現在選択中の経路プロファイル（徒歩/車）・速度・歩行アニメGIF・描画ルートID用カウンタ
var currentProfile = 'foot';
var currentSpeed = 4 / 3.6;     // km/h → m/s に換算（初期値 4 km/h）
var currentGif = 'person.gif';
var routeCounter = 0;

/**
 * 速度/プロファイル切り替え（UIボタンから呼び出し）
 * @param {'person'|'elderly'|'car'} profile 表示プロファイル
 * @param {number} speed km/h
 */
function setSpeed(profile, speed) {
    // ルーティングAPI用のprofileは car / foot の2択に正規化
    currentProfile = profile === 'car' ? 'car' : 'foot';
    // 速度は m/s に変換
    currentSpeed = speed / 3.6;
    // 歩行アニメ用GIFファイル名
    currentGif = profile + '.gif';
    // ボタンの選択状態を更新
    updateButtonSelection(profile);
}
// グローバルに公開（HTMLのonclickから呼べるように）
window.setSpeed = setSpeed;

/**
 * 右下の速度切替ボタンの選択表示を更新
 */
function updateButtonSelection(profile) {
    document.getElementById('carButton').classList.remove('selected');
    document.getElementById('personButton').classList.remove('selected');
    document.getElementById('elderlyButton').classList.remove('selected');

    if (profile === 'car') {
        document.getElementById('carButton').classList.add('selected');
    } else if (profile === 'person') {
        document.getElementById('personButton').classList.add('selected');
    } else if (profile === 'elderly') {
        document.getElementById('elderlyButton').classList.add('selected');
    }
}

// 各ハザードレイヤの表示状態
var layersVisible = {
    flood: false,
    tsunami: false,
    kaoku: false
};

/**
 * 任意レイヤのON/OFF
 */
function toggleLayer(layer) {
    layersVisible[layer] = !layersVisible[layer];
    map.setLayoutProperty(layer + '-layer', 'visibility', layersVisible[layer] ? 'visible' : 'none');
    document.getElementById(layer + 'Button').classList.toggle('selected', layersVisible[layer]);
}

/**
 * 家屋浸水（氾濫/河岸）レイヤのON/OFF（2レイヤ同時制御）
 */
function toggleKaokuLayers() {
    layersVisible.kaoku = !layersVisible.kaoku;
    map.setLayoutProperty('hanran-layer', 'visibility', layersVisible.kaoku ? 'visible' : 'none');
    map.setLayoutProperty('kagan-layer', 'visibility', layersVisible.kaoku ? 'visible' : 'none');
    document.getElementById('kaokuButton').classList.toggle('selected', layersVisible.kaoku);
}

var routes = [];                // ルート情報の保管（必要に応じて利用）
var destinationMarkers = [];    // 目的地マーカーの参照保持

// 地図クリックで計算開始
map.on('click', (e) => {
    // クリック地点を startMarker にセットするが、地図には追加しない＝「クリック地点マーカーは非表示」
    var startMarker = createStandardMarker(e.lngLat.lng, e.lngLat.lat);
    // 近傍の避難場所を取得して最短ルートを探索
    fetchNearestEvacuationPoints(e.lngLat, startMarker);
});

/**
 * MapLibreの標準Markerを生成（表示は呼び出し側で addTo したときのみ）
 */
function createStandardMarker(lng, lat) {
    return new maplibregl.Marker().setLngLat([lng, lat]);
}

/**
 * BODIK WAPIから近傍の避難場所を取得。
 * 失敗時は地図上の 'hinanbasho' レイヤからフォールバックで最近傍を抽出。
 */
async function fetchNearestEvacuationPoints(latlng, startMarker) {
    const url = new URL('https://wapi.bodik.jp/evacuation_space');
    url.searchParams.set('select_type', 'geometry');
    url.searchParams.set('maxResults', '10');
    url.searchParams.set('lat', String(latlng.lat));
    url.searchParams.set('lon', String(latlng.lng));
    url.searchParams.set('distance', '10000');

    try {
        const res = await fetch(url.toString());
        if (!res.ok) {
            const txt = await res.text();
            console.warn('WAPI status:', res.status, txt);
            throw new Error('WAPI not ok');
        }
        const data = await res.json();

        // 返却形式の揺れを吸収して features 配列に正規化
        const features =
            (data && data.resultsets && data.resultsets.features) ||
            (data && data.resultset && data.resultset.features) ||
            (data && data.features) ||
            [];

        if (!Array.isArray(features) || features.length === 0) {
            throw new Error('no features from WAPI');
        }

        // 候補点を [lng,lat] + 属性 に整形
        const candidates = features
            .filter(f => f && f.geometry && Array.isArray(f.geometry.coordinates))
            .map(f => ({
                coordinates: f.geometry.coordinates,     // [lng, lat]
                properties: f.properties || {}
            }));

        findShortestRoute(startMarker, candidates);
    } catch (err) {
        console.error('Error fetching evacuation points (WAPI):', err);

        // ---- フォールバック：画面上に描画済みの 'hinanbasho' から最近傍を採用 ----
        const rendered = map.queryRenderedFeatures({ layers: ['hinanbasho'] });
        if (!rendered.length) {
            alert('避難場所が見つかりません（WAPI/フォールバックともに失敗）');
            return;
        }

        // クリック地点からの直線距離で近い順に5件抽出
        const R = 6371000, toRad = d => d * Math.PI / 180;
        const dist = (a, b) => {
            const [lng1, lat1] = a, [lng2, lat2] = b;
            const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
            const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
            return 2 * R * Math.asin(Math.sqrt(s));
        };

        const candidates = rendered.map(f => ({
            coordinates: f.geometry.coordinates,
            properties: f.properties || {}
        }))
            .sort((a, b) =>
                dist([a.coordinates[0], a.coordinates[1]], [latlng.lng, latlng.lat]) -
                dist([b.coordinates[0], b.coordinates[1]], [latlng.lng, latlng.lat])
            )
            .slice(0, 5);

        findShortestRoute(startMarker, candidates);
    }
}

/**
 * 候補の避難場所それぞれに対してルート検索し、最短ルートを選ぶ
 */
function findShortestRoute(startMarker, candidates) {
    var routesPromises = candidates.map(candidate => {
        var endLatLng = { lat: candidate.coordinates[1], lng: candidate.coordinates[0] };
        // BODIKのルーティングAPI。pointは lat,lng の順で指定
        var url = `https://apps.bodik.jp/route?point=${startMarker.getLngLat().lat},${startMarker.getLngLat().lng}&point=${endLatLng.lat},${endLatLng.lng}&profile=${currentProfile}&type=json`;

        return fetch(url)
            .then(response => response.json())
            .then(data => {
                return {
                    route: data.paths[0],     // GraphHopper互換のレスポンス想定
                    endLatLng: endLatLng,
                    properties: candidate.properties
                };
            });
    });

    Promise.all(routesPromises)
        .then(routes => {
            // 距離が最小のものを最短ルートとして採用
            var shortestRoute = routes.reduce((prev, curr) => {
                return (prev.route.distance < curr.route.distance) ? prev : curr;
            });

            displayRoute(startMarker, shortestRoute);
        })
        .catch(error => {
            console.error("Error fetching routes:", error);
        });
}

/**
 * 選ばれた最短ルートを地図に描画し、マーカー/ポップアップ/歩行アニメを開始
 */
function displayRoute(startMarker, shortestRoute) {
    // ポリライン（エンコード）→配列座標（[lng,lat]）に復元
    var route = shortestRoute.route.points;
    var decodedRoute = polyline.decode(route);
    var latLngs = decodedRoute.map(function (point) {
        return [point[1], point[0]]; // polylineは [lat, lng] なので [lng, lat] へ並べ替え
    });

    var totalDistance = getTotalDistance(latLngs);   // ルート全長（m）
    var color = getRouteColor(totalDistance);        // 全長に応じた線色

    // ルート線の追加
    var routeSourceId = 'route' + routeCounter++;
    map.addSource(routeSourceId, {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: latLngs
            }
        }
    });
    map.addLayer({
        id: routeSourceId,
        type: 'line',
        source: routeSourceId,
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': color,
            'line-width': 8
        }
    });

    // === 目的地マーカー：添付の避難所アイコンGIFで表示 ===
    const evacImg = document.createElement('img');
    evacImg.src = './gif/evac_place.gif';   // 添付GIF（配置パスに合わせて調整）
    evacImg.alt = '避難場所';
    evacImg.style.width = '32px';
    evacImg.style.height = '32px';

    // 目的地マーカー（下端を基準に配置するとピクトの見栄えが良い）
    var destinationMarker = new maplibregl.Marker({
        element: evacImg,
        anchor: 'bottom'
    })
        .setLngLat([shortestRoute.endLatLng.lng, shortestRoute.endLatLng.lat])
        // ★ 目的地名のポップアップ：上方向にオフセット
        //    anchor:'bottom' でマーカーの上に出し、さらに offset で上にずらす
        .setPopup(new maplibregl.Popup({
            className: 'custom-popup',
            anchor: 'bottom',
            offset: [0, -40]        // オフセット
        }).setHTML(
            `<b>${shortestRoute.properties.name || '避難場所'}</b><br>${shortestRoute.properties.address || ''}`
        ))
        .addTo(map)
        .togglePopup();  // 初期表示で開く

    destinationMarkers.push(destinationMarker);

    // === 歩行アニメ用マーカー（現在の速度プロファイルのGIF） ===
    var walkerMarker = new maplibregl.Marker({
        element: document.createElement('img')
    }).setLngLat([latLngs[0][0], latLngs[0][1]]).addTo(map);

    walkerMarker.getElement().src = './gif/' + currentGif;
    walkerMarker.getElement().style.width = '32px';
    walkerMarker.getElement().style.height = '32px';

    // 現在地ポップアップ（到着までの残距離/残時間）
    const walkerPopup = new maplibregl.Popup({
        closeButton: true,
        autoClose: false,
        closeOnClick: false,
        anchor: 'top',       // 矢印を上向きに（ポップアップをマーカーの上側に）
        offset: [0, 20],     // マーカーとポップアップの間隔
        className: 'custom-popup'
    }).setHTML(
        '<b>到着まで</b><br>あと ' +
        Math.round(totalDistance) + ' メートル (' +
        formatTime(totalDistance / currentSpeed) + ')'
    );

    // マーカーにポップアップを紐付け、すぐに開く
    walkerMarker.setPopup(walkerPopup);
    walkerMarker.togglePopup();

    // 歩行アニメ開始
    startWalking(latLngs, walkerMarker, color);
}

/**
 * 歩行アニメーション。
 * ルート全長と現在速度から所要時間を計算し、requestAnimationFrameで位置を更新。
 */
function startWalking(latLngs, walkerMarker, initialColor) {
    var totalDistance = getTotalDistance(latLngs);
    var totalTime = totalDistance / currentSpeed; // 所要時間（秒）
    var distanceCovered = 0;
    var notificationShown = false;
    var messagesShown = new Set();
    var nextNotificationDistance = 10 + Math.random() * 500; // 10〜510mの間でランダム（※未使用）

    var startTime = performance.now();

    function animate() {
        var currentTime = performance.now();
        var elapsedTime = (currentTime - startTime) / 1000; // 経過秒
        var progress = elapsedTime / totalTime;

        if (progress < 1) {
            var distanceTraveled = progress * totalDistance;
            distanceCovered = 0;

            // どの線分上にいるかを探索し、線形補間で現在位置を算出
            for (var i = 1; i < latLngs.length; i++) {
                var segmentDistance = distance([latLngs[i - 1][0], latLngs[i - 1][1]], [latLngs[i][0], latLngs[i][1]]);
                if (distanceCovered + segmentDistance >= distanceTraveled) {
                    var segmentProgress = (distanceTraveled - distanceCovered) / segmentDistance;
                    var currentLat = latLngs[i - 1][1] + segmentProgress * (latLngs[i][1] - latLngs[i - 1][1]);
                    var currentLng = latLngs[i - 1][0] + segmentProgress * (latLngs[i][0] - latLngs[i - 1][0]);
                    var currentPosition = [currentLng, currentLat];

                    // マーカー位置更新
                    walkerMarker.setLngLat(currentPosition);

                    // 残距離/残時間をポップアップに反映
                    var remainingDistance = totalDistance - distanceTraveled;
                    var remainingTime = totalTime - elapsedTime;
                    if (walkerMarker.getPopup()) {
                        walkerMarker.getPopup()
                            .setLngLat(currentPosition)
                            .setHTML('<b>到着まで</b><br>あと ' + Math.round(remainingDistance) + ' メートル (' + formatTime(remainingTime) + ')');
                    }

                    // 100m単位の現在距離（必要なら通知等に使用）
                    var currentDistance = Math.floor(distanceTraveled / 100) * 100;

                    break;
                }
                distanceCovered += segmentDistance;
            }

            requestAnimationFrame(animate);
        } else {
            // 到着したら歩行マーカーを除去
            walkerMarker.remove();
        }
    }

    requestAnimationFrame(animate);
}

/**
 * ルート全長（m）をハーサイン距離の総和で算出
 */
function getTotalDistance(latLngs) {
    var totalDistance = 0;
    for (var i = 1; i < latLngs.length; i++) {
        totalDistance += distance([latLngs[i - 1][0], latLngs[i - 1][1]], [latLngs[i][0], latLngs[i][1]]);
    }
    return totalDistance;
}

/**
 * 秒 → 「X分 Y秒」表記に変換
 */
function formatTime(seconds) {
    var minutes = Math.floor(seconds / 60);
    var remainingSeconds = Math.floor(seconds % 60);
    return minutes + '分 ' + remainingSeconds + '秒';
}

/**
 * 全長に応じて線色を段階設定
 */
function getRouteColor(distance) {
    if (distance <= 250) {
        return 'blue';
    } else if (distance <= 500) {
        return '#3366FF';
    } else if (distance <= 750) {
        return '#6699FF';
    } else if (distance <= 1000) {
        return '#99CCFF';
    } else if (distance <= 1250) {
        return '#CCFFFF';
    } else if (distance <= 1500) {
        return '#FFCCCC';
    } else if (distance <= 1750) {
        return '#FF9999';
    } else if (distance <= 2000) {
        return '#FF6666';
    } else {
        return 'red';
    }
}

/**
 * 画面内にある地点のみ一時ポップアップを表示（通知用途）
 */
function showPopupIfInView(content, latLng) {
    var mapBounds = map.getBounds();
    if (mapBounds.contains(latLng)) {
        var popup = new maplibregl.Popup({
            closeButton: true,
            autoClose: true,
            closeOnClick: false,
            offset: [0, -20],
            className: 'custom-popup'
        })
            .setLngLat(latLng)
            .setHTML(content)
            .addTo(map);

        setTimeout(() => {
            popup.remove();
        }, 3000);
    }
}

/**
 * デモ用：現在の表示範囲にランダムで複数スタート点を発生させる
 * ここでは addTo(map) しているためスタートマーカーが表示される（デモなのでOK）
 */
function populateRandomPoints() {
    var bounds = map.getBounds();
    var latMin = bounds.getSouthWest().lat;
    var latMax = bounds.getNorthEast().lat;
    var lngMin = bounds.getSouthWest().lng;
    var lngMax = bounds.getNorthEast().lng;

    for (var i = 0; i < 10; i++) {
        var lat = Math.random() * (latMax - latMin) + latMin;
        var lng = Math.random() * (lngMax - lngMin) + lngMin;
        var startLatLng = { lat: lat, lng: lng };
        var startMarker = createStandardMarker(startLatLng.lng, startLatLng.lat);
        startMarker.addTo(map); // ← デモ表示用。通常運用では外して非表示にする
        fetchNearestEvacuationPoints(startLatLng, startMarker);
    }
}

/**
 * 2点間のハーサイン距離（m）
 */
function distance(latlng1, latlng2) {
    var R = 6371e3; // 地球半径[m]
    var φ1 = latlng1[1] * Math.PI / 180;
    var φ2 = latlng2[1] * Math.PI / 180;
    var Δφ = (latlng2[1] - latlng1[1]) * Math.PI / 180;
    var Δλ = (latlng2[0] - latlng1[0]) * Math.PI / 180;

    var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    var d = R * c;
    return d;
}

// 初期化時にデフォルト選択（一般の人）
updateButtonSelection('person');
