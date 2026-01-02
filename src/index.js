// ===== 全局配置 =====
const COLORS = {
    primary: "#00d4ff",
    secondary: "#7c3aed",
    tertiary: "#f59e0b",
    danger: "#ef4444",
    success: "#10b981",
    pink: "#ec4899",
    bg: "#0a0e1a",
    text: "#f0f4f8"
};

let healthData = [];
let behaviorData = [];
let socialData = [];
let globalData = [];
let filteredHealthData = [];
let worldGeoData = null;
let worldRotation = [0, -10];

const tooltip = d3.select("#tooltip");

// ===== 初始化星空背景 =====
function createStars() {
    const starsContainer = d3.select("#stars");
    for (let i = 0; i < 100; i++) {
        starsContainer.append("div")
            .attr("class", "star")
            .style("left", Math.random() * 100 + "%")
            .style("top", Math.random() * 100 + "%")
            .style("width", (Math.random() * 2 + 1) + "px")
            .style("height", (Math.random() * 2 + 1) + "px")
            .style("animation-delay", Math.random() * 3 + "s");
    }
}

// ===== 数据加载 =====
Promise.all([
    d3.csv("Sleep_health_and_lifestyle_dataset.csv"),
    d3.csv("late_night_behavior.csv"),
    d3.csv("social_media_sleep_impact.csv"),
    d3.csv("global_sleep_stats.csv")
]).then(([health, behavior, social, global]) => {
    
    // 处理健康数据
    const BMI_MAP = { "Normal Weight": "正常", "Normal": "正常", "Overweight": "超重", "Obese": "肥胖" };
    const DISORDER_MAP = { "None": "无睡眠障碍", "No Disorder": "无睡眠障碍", "Sleep Apnea": "睡眠呼吸暂停", "Insomnia": "失眠" };

    healthData = health.map(d => ({
        id: d['Person ID'],
        gender: d.Gender,
        age: +d.Age,
        occupation: d.Occupation,
        sleepDuration: +d['Sleep Duration'],
        sleepQuality: +d['Quality of Sleep'],
        activityLevel: +d['Physical Activity Level'],
        stressLevel: +d['Stress Level'],
        bmi: BMI_MAP[d['BMI Category']] || BMI_MAP[d['BMI Category']?.trim()] || d['BMI Category'],
        heartRate: +d['Heart Rate'],
        steps: +d['Daily Steps'],
        disorder: DISORDER_MAP[d['Sleep Disorder']] || DISORDER_MAP[d['Sleep Disorder']?.trim()] || d['Sleep Disorder']
    }));

    // 处理熬夜行为数据
    behaviorData = behavior.map(d => ({
        hour: +d.hour,
        dayType: d.day_type,
        socialMedia: +d.social_media,
        gaming: +d.gaming,
        workStudy: +d.work_study,
        videoStreaming: +d.video_streaming,
        browsing: +d.browsing,
        caffeine: +d.caffeine_consumed,
        peopleCount: +d.people_count
    }));

    // 处理社交媒体数据
    socialData = social.map(d => ({
        ageGroup: d.age_group,
        platform: d.platform,
        dailyHours: +d.daily_hours,
        lateNightUsage: +d.late_night_usage,
        sleepQuality: +d.sleep_quality_score,
        addiction: +d.addiction_level,
        avgSleep: +d.avg_sleep_hours
    }));

    // 处理全球数据
    globalData = global.map(d => ({
        country: d.country,
        region: d.region,
        avgSleep: +d.avg_sleep_hours,
        lateNightRate: +d.late_night_rate,
        workHours: +d.work_hours_per_week,
        stressLevel: +d.stress_level,
        internetHours: +d.internet_hours,
        disorderRate: +d.sleep_disorder_rate
    }));

    d3.select("#loader").style("display", "none");
    createStars();
    initializeApp();

}).catch(err => {
    console.error("数据加载失败:", err);
    alert("数据加载失败！请检查CSV文件是否存在。");
});

// ===== 初始化应用 =====
function initializeApp() {
    filteredHealthData = healthData;
    
    // 初始化导航
    d3.selectAll(".nav-tab").on("click", function() {
        const page = this.dataset.page;
        d3.selectAll(".nav-tab").classed("active", false);
        d3.select(this).classed("active", true);
        d3.selectAll(".page-section").classed("active", false);
        d3.select(`#page-${page}`).classed("active", true);
        
        // 根据页面初始化相应图表
        if (page === "overview") {
            setTimeout(() => initOverviewPage(), 100);
        } else if (page === "behavior") {
            setTimeout(() => initBehaviorPage(), 100);
        } else if (page === "health") {
            setTimeout(() => initHealthPage(), 100);
        } else if (page === "global") {
            setTimeout(() => initGlobalPage(), 100);
        }
    });

    // 初始化第一页
    initOverviewPage();
}

// ===== 第一页：总览 =====
function initOverviewPage() {
    updateKPIs();
    initOccupationFilter();
    drawScatter();
    drawRadar(null);
    drawStackedBar();
    drawStressSleepChart();
}

function updateKPIs() {
    const data = filteredHealthData;
    const disorderRate = (data.filter(d => d.disorder !== "无睡眠障碍").length / data.length * 100).toFixed(1);
    
    d3.select("#kpi-total").text(data.length);
    d3.select("#kpi-sleep").text(d3.mean(data, d => d.sleepDuration).toFixed(1));
    d3.select("#kpi-stress").text(d3.mean(data, d => d.stressLevel).toFixed(1));
    d3.select("#kpi-steps").text(d3.format(",")(Math.round(d3.mean(data, d => d.steps))));
    d3.select("#kpi-disorder").text(disorderRate);
}

function initOccupationFilter() {
    const occupations = Array.from(new Set(healthData.map(d => d.occupation))).sort();
    const select = d3.select("#occupationFilter");
    select.selectAll("option:not(:first-child)").remove();
    
    occupations.forEach(occ => {
        select.append("option").attr("value", occ).text(occ);
    });

    select.on("change", function() {
        const value = this.value;
        filteredHealthData = value === "all" ? healthData : healthData.filter(d => d.occupation === value);
        updateKPIs();
        drawScatter();
        drawRadar(null);
        drawStackedBar();
        drawStressSleepChart();
    });
}

// 气泡散点图
function drawScatter() {
    const container = d3.select("#scatter-chart");
    container.selectAll("*").remove();
    
    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const margin = {top: 20, right: 20, bottom: 60, left: 60};
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([20, 100])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([3, 10])
        .range([height, 0]);

    const color = d3.scaleOrdinal()
        .domain(["正常", "超重", "肥胖"])
        .range([COLORS.success, COLORS.tertiary, COLORS.danger]);

    // 添加网格线
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSize(-height).tickFormat(""))
        .style("stroke-opacity", 0.1);

    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(""))
        .style("stroke-opacity", 0.1);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .attr("class", "axis");

    svg.append("g")
        .call(d3.axisLeft(y))
        .attr("class", "axis");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 45)
        .attr("fill", COLORS.text)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("运动量 (分钟/天)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -45)
        .attr("x", -height / 2)
        .attr("fill", COLORS.text)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("睡眠质量 (1-10)");

    svg.selectAll("circle")
        .data(filteredHealthData)
        .join("circle")
        .attr("cx", d => x(d.activityLevel))
        .attr("cy", d => y(d.sleepQuality))
        .attr("r", d => d.sleepDuration * 1.5)
        .style("fill", d => color(d.bmi))
        .style("opacity", 0.6)
        .style("stroke", "#fff")
        .style("stroke-width", 0.5)
        .on("mouseover", (event, d) => {
            showTooltip(event, `
                <div class="tooltip-title">${d.occupation}</div>
                <div class="tooltip-row">
                    <span>性别/年龄:</span>
                    <span>${d.gender}, ${d.age}岁</span>
                </div>
                <div class="tooltip-row">
                    <span>BMI:</span>
                    <span>${d.bmi}</span>
                </div>
                <div class="tooltip-row">
                    <span>睡眠时长:</span>
                    <span>${d.sleepDuration}小时</span>
                </div>
                <div class="tooltip-row">
                    <span>睡眠质量:</span>
                    <span>${d.sleepQuality}/10</span>
                </div>
                <div class="tooltip-row">
                    <span>日均步数:</span>
                    <span>${d3.format(",")(d.steps)}</span>
                </div>
            `);
            d3.select(event.currentTarget)
                .transition()
                .duration(200)
                .style("opacity", 1)
                .style("stroke-width", 2);
            
            drawRadar(d);
        })
        .on("mouseout", (event, d) => {
            hideTooltip();
            d3.select(event.currentTarget)
                .transition()
                .duration(200)
                .style("opacity", 0.6)
                .style("stroke-width", 0.5);
            
            drawRadar(null);
        });

    // 图例
    const legend = d3.select("#scatter-legend");
    legend.html("");
    ["正常", "超重", "肥胖"].forEach(bmi => {
        const item = legend.append("div").attr("class", "legend-item");
        item.append("div")
            .attr("class", "legend-color")
            .style("background", color(bmi));
        item.append("span").text(bmi);
    });
}

// 雷达图
function drawRadar(userData) {
    const container = d3.select("#radar-chart");
    container.selectAll("*").remove();

    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const radius = Math.min(containerWidth, containerHeight) / 2 - 40;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${containerWidth/2},${containerHeight/2})`);

    const features = ["睡眠时长", "睡眠质量", "压力水平", "运动量", "心率健康"];
    const angleSlice = Math.PI * 2 / features.length;

    const normalize = (d) => ({
        "睡眠时长": (d.sleepDuration / 10) * 10,
        "睡眠质量": (d.sleepQuality / 10) * 10,
        "压力水平": (10 - d.stressLevel),
        "运动量": (d.activityLevel / 100) * 10,
        "心率健康": Math.max(0, Math.min(10, ((100 - Math.abs(d.heartRate - 70)) / 100) * 10))
    });

    // 计算平均值
    const avgData = {
        sleepDuration: d3.mean(filteredHealthData, d => d.sleepDuration),
        sleepQuality: d3.mean(filteredHealthData, d => d.sleepQuality),
        stressLevel: d3.mean(filteredHealthData, d => d.stressLevel),
        activityLevel: d3.mean(filteredHealthData, d => d.activityLevel),
        heartRate: d3.mean(filteredHealthData, d => d.heartRate)
    };

    const rScale = d3.scaleLinear().range([0, radius]).domain([0, 10]);

    // 绘制网格
    [2, 4, 6, 8, 10].forEach(level => {
        svg.append("circle")
            .attr("r", rScale(level))
            .style("fill", "none")
            .style("stroke", level === 10 ? "rgba(100, 140, 200, 0.5)" : "rgba(100, 140, 200, 0.3)")
            .style("stroke-dasharray", level === 10 ? "none" : "5,5")
            .style("stroke-width", level === 10 ? 2 : 1);
    });

    // 绘制轴线
    features.forEach((feature, i) => {
        const angle = angleSlice * i - Math.PI/2;
        const x = rScale(10) * Math.cos(angle);
        const y = rScale(10) * Math.sin(angle);
        
        svg.append("line")
            .attr("x1", 0).attr("y1", 0)
            .attr("x2", x).attr("y2", y)
            .style("stroke", "rgba(100, 140, 200, 0.3)");

        // 调整文字位置，睡眠时长（第一个）稍微靠近
        const distance = i === 0 ? 11.5 : 13;
        svg.append("text")
            .attr("x", rScale(distance) * Math.cos(angle))
            .attr("y", rScale(distance) * Math.sin(angle))
            .text(feature)
            .style("text-anchor", "middle")
            .style("font-size", "11px")
            .style("fill", COLORS.text);
    });

    const line = d3.lineRadial()
        .angle((d, i) => i * angleSlice)
        .radius(d => rScale(d))
        .curve(d3.curveLinearClosed);

    const normalizedAvg = features.map(f => normalize(avgData)[f]);

    svg.append("path")
        .datum(normalizedAvg)
        .attr("d", line)
        .style("fill", COLORS.primary)
        .style("fill-opacity", 0.2)
        .style("stroke", COLORS.primary)
        .style("stroke-width", 2);

    if (userData) {
        const normalizedUser = features.map(f => normalize(userData)[f]);
        
        svg.append("path")
            .datum(normalizedUser)
            .attr("d", line)
            .style("fill", "none")
            .style("stroke", "#fff")
            .style("stroke-width", 2.5);
    }
}

// 堆叠条形图
function drawStackedBar() {
    const container = d3.select("#stacked-bar-chart");
    container.selectAll("*").remove();

    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const margin = {top: 20, right: 100, bottom: 40, left: 60};
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const groups = ["正常", "超重", "肥胖"];
    const subgroups = ["无睡眠障碍", "睡眠呼吸暂停", "失眠"];

    let preparedData = [];
    groups.forEach(g => {
        let obj = { group: g };
        subgroups.forEach(sub => {
            obj[sub] = filteredHealthData.filter(d => d.bmi === g && d.disorder === sub).length;
        });
        preparedData.push(obj);
    });

    const stackedData = d3.stack().keys(subgroups)(preparedData);

    const x = d3.scaleBand()
        .domain(groups)
        .range([0, width])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, d3.max(preparedData, d => d["无睡眠障碍"] + d["睡眠呼吸暂停"] + d["失眠"])])
        .range([height, 0]);

    const color = d3.scaleOrdinal()
        .domain(subgroups)
        .range([COLORS.success, COLORS.tertiary, COLORS.danger]);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .attr("class", "axis");

    svg.append("g")
        .call(d3.axisLeft(y))
        .attr("class", "axis");

    svg.append("g")
        .selectAll("g")
        .data(stackedData)
        .join("g")
        .attr("fill", d => color(d.key))
        .selectAll("rect")
        .data(d => d)
        .join("rect")
        .attr("x", d => x(d.data.group))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth())
        .on("mouseover", (event, d) => {
            const subgroupName = d3.select(event.currentTarget.parentNode).datum().key;
            showTooltip(event, `
                <div class="tooltip-title">${d.data.group}</div>
                <div class="tooltip-row">
                    <span>${subgroupName}:</span>
                    <span>${d.data[subgroupName]} 人</span>
                </div>
            `);
            d3.select(event.currentTarget).style("opacity", 0.8);
        })
        .on("mouseout", (event) => {
            hideTooltip();
            d3.select(event.currentTarget).style("opacity", 1);
        });

    // 图例
    const legend = svg.append("g").attr("transform", `translate(${width - 90}, 10)`);
    subgroups.forEach((sub, i) => {
        const g = legend.append("g").attr("transform", `translate(0,${i * 20})`);
        g.append("rect")
            .attr("width", 12)
            .attr("height", 12)
            .style("fill", color(sub));
        g.append("text")
            .attr("x", 18)
            .attr("y", 10)
            .text(sub)
            .style("fill", COLORS.text)
            .style("font-size", "10px");
    });
}

// 环形图
function drawStressSleepChart() {
    const container = d3.select("#stress-sleep-chart");
    container.selectAll("*").remove();

    const data = filteredHealthData;
    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const margin = {top: 30, right: 80, bottom: 50, left: 60};
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 1. 定义比例尺
    const x = d3.scaleLinear()
        .domain([d3.min(data, d => d.sleepDuration) - 0.5, d3.max(data, d => d.sleepDuration) + 0.5])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, 10])
        .range([height, 0]);

    // 2. 计算密度等高线
    const densityData = d3.contourDensity()
        .x(d => x(d.sleepDuration))
        .y(d => y(d.stressLevel))
        .size([width, height])
        .bandwidth(25) // 平滑度
        .thresholds(20) // 层级数量
        (data);

    // 3. 颜色比例尺 (Turbo 适合热力图)
    const color = d3.scaleSequential(d3.interpolateTurbo)
        .domain([0, d3.max(densityData, d => d.value)]);

    // 4. 绘制背景网格
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSize(-height).tickFormat(""))
        .style("stroke-opacity", 0.1);

    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(""))
        .style("stroke-opacity", 0.1);

    // 5. 绘制等高线路径
    svg.append("g")
        .selectAll("path")
        .data(densityData)
        .enter().append("path")
        .attr("d", d3.geoPath())
        .attr("fill", d => color(d.value))
        .attr("stroke", "none")
        .style("opacity", 0.8);

    // 6. 添加散点 (低透明度，用于展示具体分布)
    svg.selectAll("circle")
        .data(data)
        .enter().append("circle")
        .attr("cx", d => x(d.sleepDuration))
        .attr("cy", d => y(d.stressLevel))
        .attr("r", 2)
        .style("fill", "#fff")
        .style("opacity", 0.2)
        .style("pointer-events", "none"); // 不干扰交互

    // 7. 坐标轴
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .attr("class", "axis")
        .style("font-size", "12px");

    svg.append("g")
        .call(d3.axisLeft(y))
        .attr("class", "axis")
        .style("font-size", "12px");

    // 8. 轴标签
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .attr("fill", COLORS.text)
        .style("text-anchor", "middle")
        .text("睡眠时长 (小时)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -40)
        .attr("x", -height / 2)
        .attr("fill", COLORS.text)
        .style("text-anchor", "middle")
        .text("压力水平 (1-10)");

    // 9. 添加热力图图例
    const legendHeight = 150;
    const legendWidth = 15;
    
    const legendSvg = svg.append("g")
        .attr("transform", `translate(${width + 20}, ${(height - legendHeight) / 2})`);

    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", "linear-gradient")
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");

    // 生成渐变色
    const numStops = 10;
    for (let i = 0; i <= numStops; i++) {
        const offset = i / numStops;
        linearGradient.append("stop")
            .attr("offset", `${offset * 100}%`)
            .attr("stop-color", d3.interpolateTurbo(offset));
    }

    legendSvg.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#linear-gradient)")
        .style("stroke", "#ccc")
        .style("stroke-width", 0.5);

    // 图例标签
    legendSvg.append("text")
        .attr("x", legendWidth + 5)
        .attr("y", 10)
        .style("fill", COLORS.text)
        .style("font-size", "10px")
        .text("高密度");

    legendSvg.append("text")
        .attr("x", legendWidth + 5)
        .attr("y", legendHeight)
        .style("fill", COLORS.text)
        .style("font-size", "10px")
        .text("低密度");

    // 10. 添加"热点"标注 (找出密度最高的区域)
    if (densityData.length > 0) {
        // 简单地在图表上方添加说明
        svg.append("text")
            .attr("x", width - 10)
            .attr("y", 20)
            .attr("text-anchor", "end")
            .style("fill", COLORS.text)
            .style("font-size", "12px")
            .style("font-style", "italic")
            .text("颜色越暖表示人群越集中");
    }
}

// ===== 第二页：熬夜行为分析 =====
function initBehaviorPage() {
    drawHeatmap("weekday");
    drawClockChart();
    drawActivityPie();
    drawHourlyTrend();
    
    // 绑定按钮事件
    d3.selectAll('[data-type]').on("click", function() {
        d3.selectAll('[data-type]').classed("active", false);
        d3.select(this).classed("active", true);
        drawHeatmap(this.dataset.type);
    });
}

// 热力图
function drawHeatmap(dayType) {
    const container = d3.select("#heatmap-chart");
    container.selectAll("*").remove();

    const data = behaviorData.filter(d => d.dayType === dayType);
    const activities = ["socialMedia", "gaming", "workStudy", "videoStreaming", "browsing"];
    const activityLabels = ["社交媒体", "游戏", "工作学习", "视频", "浏览"];
    
    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const margin = {top: 40, right: 80, bottom: 40, left: 80};
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(data.map(d => d.hour + ":00"))
        .range([0, width])
        .padding(0.05);

    const y = d3.scaleBand()
        .domain(activityLabels)
        .range([0, height])
        .padding(0.05);

    const colorScale = d3.scaleSequential()
        .domain([0, 100])
        .interpolator(d3.interpolateRgb("#1e293b", COLORS.danger));

    // 绘制热力格
    activities.forEach((activity, i) => {
        data.forEach(d => {
            svg.append("rect")
                .attr("data-hour", d.hour) // 添加 data-hour 属性用于联动
                .attr("x", x(d.hour + ":00"))
                .attr("y", y(activityLabels[i]))
                .attr("width", x.bandwidth())
                .attr("height", y.bandwidth())
                .style("fill", colorScale(d[activity]))
                .style("stroke", "#0a0e1a")
                .style("stroke-width", 1)
                .on("mouseover", function(event) {
                    showTooltip(event, `
                        <div class="tooltip-title">${d.hour}:00 - ${activityLabels[i]}</div>
                        <div class="tooltip-row">
                            <span>活跃度:</span>
                            <span>${d[activity]}%</span>
                        </div>
                        <div class="tooltip-row">
                            <span>在线人数:</span>
                            <span>${d.peopleCount}</span>
                        </div>
                    `);
                    d3.select(this).style("stroke-width", 2).style("stroke", COLORS.primary);
                })
                .on("mouseout", function() {
                    hideTooltip();
                    d3.select(this).style("stroke-width", 1).style("stroke", "#0a0e1a");
                });
        });
    });

    // X轴
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .attr("class", "axis");

    // Y轴
    svg.append("g")
        .call(d3.axisLeft(y))
        .attr("class", "axis");

    // 颜色图例
    const legendWidth = 200;
    const legendHeight = 10;
    const legendX = width - legendWidth;
    const legendY = -30;

    const legendScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
        .ticks(5)
        .tickFormat(d => d + "%");

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "heatmap-gradient");

    gradient.selectAll("stop")
        .data([
            {offset: "0%", color: "#1e293b"},
            {offset: "100%", color: COLORS.danger}
        ])
        .join("stop")
        .attr("offset", d => d.offset)
        .attr("stop-color", d => d.color);

    svg.append("rect")
        .attr("x", legendX)
        .attr("y", legendY)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#heatmap-gradient)");

    svg.append("g")
        .attr("transform", `translate(${legendX},${legendY + legendHeight})`)
        .call(legendAxis)
        .attr("class", "axis")
        .style("font-size", "9px");
}

// 24小时时钟图
function drawClockChart() {
    const container = d3.select("#clock-chart");
    container.selectAll("*").remove();

    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const radius = Math.min(containerWidth, containerHeight) / 2 - 30;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${containerWidth/2},${containerHeight/2})`);

    // 提取实际有数据的小时
    const uniqueHours = [...new Set(behaviorData.map(d => d.hour))].sort((a, b) => a - b);
    
    // 计算每小时平均活跃人数（只计算有数据的时段）
    const activeData = uniqueHours.map(hour => {
        const records = behaviorData.filter(d => d.hour === hour);
        const avgPeople = d3.mean(records, d => d.peopleCount);
        return { hour, people: avgPeople };
    });

    const angleScale = d3.scaleLinear()
        .domain([0, 24])
        .range([0, 2 * Math.PI]);

    const radiusScale = d3.scaleLinear()
        .domain([0, d3.max(activeData, d => d.people)])
        .range([0, radius]);

    // 添加渐变定义
    const gradient = svg.append("defs")
        .append("radialGradient")
        .attr("id", "glow-gradient")
        .attr("cx", "50%")
        .attr("cy", "50%")
        .attr("r", "50%");
    
    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", COLORS.primary)
        .attr("stop-opacity", 0.8);
    
    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", COLORS.primary)
        .attr("stop-opacity", 0);

    // 绘制参考圆环（表示不同的活跃度级别）
    const levels = [0.25, 0.5, 0.75, 1];
    levels.forEach(level => {
        svg.append("circle")
            .attr("r", radius * level)
            .style("fill", "none")
            .style("stroke", "rgba(100, 140, 200, 0.3)")
            .style("stroke-dasharray", "5,5")
            .style("stroke-width", 1);
    });

    // 高亮深夜时段背景（22:00 - 3:00的扇形区域）
    const nightStartAngle = angleScale(22) - Math.PI / 2;
    const nightEndAngle = angleScale(4) - Math.PI / 2; // 到4点（因为3点后面是4点）
    
    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(radius)
        .startAngle(nightStartAngle)
        .endAngle(nightEndAngle);
    
    svg.append("path")
        .attr("d", arc)
        .style("fill", COLORS.danger)
        .style("fill-opacity", 0.05);

    // 绘制时钟圆圈
    svg.append("circle")
        .attr("r", radius)
        .style("fill", "none")
        .style("stroke", "rgba(100, 140, 200, 0.3)")
        .style("stroke-width", 2);

    // 绘制24小时刻度（显示所有小时）
    d3.range(0, 24).forEach(hour => {
        const angle = angleScale(hour) - Math.PI / 2;
        const x1 = radius * 0.9 * Math.cos(angle);
        const y1 = radius * 0.9 * Math.sin(angle);
        const x2 = radius * Math.cos(angle);
        const y2 = radius * Math.sin(angle);

        svg.append("line")
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x2)
            .attr("y2", y2)
            .style("stroke", "rgba(100, 140, 200, 0.3)");

        // 小时标签
        const labelX = radius * 1.15 * Math.cos(angle);
        const labelY = radius * 1.15 * Math.sin(angle);
        
        svg.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .text(hour)
            .style("font-size", "10px")
            .style("fill", COLORS.text);
    });

    // 绘制从中心到数据点的射线
    activeData.forEach(d => {
        const angle = angleScale(d.hour) - Math.PI / 2;
        const r = radiusScale(d.people);
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);

        svg.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", x)
            .attr("y2", y)
            .style("stroke", COLORS.primary)
            .style("stroke-width", 1.5)
            .style("stroke-opacity", 0.4);
    });

    // 绘制数据点
    activeData.forEach(d => {
        const angle = angleScale(d.hour) - Math.PI / 2;
        const r = radiusScale(d.people);
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);

        // 添加发光效果的外圈
        svg.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", 10)
            .style("fill", "url(#glow-gradient)")
            .style("opacity", 0.5);

        // 数据点本身
        svg.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", 5)
            .style("fill", COLORS.danger)
            .style("stroke", "#fff")
            .style("stroke-width", 2)
            .on("mouseover", function(event) {
                d3.select(this).attr("r", 7);
                showTooltip(event, `
                    <div class="tooltip-title">${d.hour}:00</div>
                    <div class="tooltip-row">
                        <span>平均在线:</span>
                        <span>${Math.round(d.people)} 人</span>
                    </div>
                `);
            })
            .on("mouseout", function() {
                d3.select(this).attr("r", 5);
                hideTooltip();
            });
    });
}

// 活动类型玫瑰图 (Nightingale Rose Chart)
function drawActivityPie() {
    const container = d3.select("#activity-pie-chart");
    container.selectAll("*").remove();

    // 统计深夜时段(22-3点)各类活动总量
    const lateNightData = behaviorData.filter(d => d.hour >= 22 || d.hour <= 3);
    const activityTotals = {
        "社交媒体": d3.sum(lateNightData, d => d.socialMedia),
        "游戏": d3.sum(lateNightData, d => d.gaming),
        "工作学习": d3.sum(lateNightData, d => d.workStudy),
        "视频": d3.sum(lateNightData, d => d.videoStreaming),
        "浏览": d3.sum(lateNightData, d => d.browsing)
    };

    const pieData = Object.entries(activityTotals).map(([k, v]) => ({ activity: k, value: v }));

    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const radius = Math.min(containerWidth, containerHeight) / 2 - 20;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${containerWidth/2},${containerHeight/2})`);

    const color = d3.scaleOrdinal()
        .domain(["社交媒体", "游戏", "工作学习", "视频", "浏览"])
        .range([COLORS.pink, COLORS.danger, COLORS.tertiary, COLORS.secondary, COLORS.success]);

    // 玫瑰图比例尺 - 使用sqrt刻度使面积与数据值成正比
    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(pieData, d => d.value)])
        .range([0, radius]);

    const angleScale = d3.scaleBand()
        .domain(pieData.map(d => d.activity))
        .range([0, 2 * Math.PI])
        .align(0);

    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(d => radiusScale(d.value))
        .startAngle(d => angleScale(d.activity))
        .endAngle(d => angleScale(d.activity) + angleScale.bandwidth())
        .padAngle(0.05)
        .padRadius(0)
        .cornerRadius(4);

    // 绘制花瓣
    svg.selectAll("path")
        .data(pieData)
        .join("path")
        .attr("d", arc)
        .attr("fill", d => color(d.activity))
        .attr("stroke", "#0a0e1a")
        .style("stroke-width", "1px")
        .style("opacity", 0.8)
        .on("mouseover", function(event, d) {
            const total = d3.sum(pieData, item => item.value);
            const pct = (d.value / total * 100).toFixed(1);
            showTooltip(event, `
                <div class="tooltip-title">${d.activity}</div>
                <div class="tooltip-row">
                    <span>活跃度:</span>
                    <span>${d.value.toFixed(0)}</span>
                </div>
                <div class="tooltip-row">
                    <span>占比:</span>
                    <span>${pct}%</span>
                </div>
            `);
            d3.select(this)
                .transition()
                .duration(200)
                .style("opacity", 1)
                .attr("transform", "scale(1.05)");
        })
        .on("mouseout", function() {
            hideTooltip();
            d3.select(this)
                .transition()
                .duration(200)
                .style("opacity", 0.8)
                .attr("transform", "scale(1)");
        });

    // 添加标签
    svg.selectAll("text")
        .data(pieData)
        .join("text")
        .attr("transform", d => {
            const angle = angleScale(d.activity) + angleScale.bandwidth() / 2 - Math.PI / 2;
            const r = radiusScale(d.value) + 15;
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            return `translate(${x},${y})`;
        })
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", COLORS.text)
        .style("font-weight", "500")
        .text(d => d.activity);
}

// 每小时人数趋势
function drawHourlyTrend() {
    const container = d3.select("#hourly-trend-chart");
    container.selectAll("*").remove();

    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const margin = {top: 20, right: 30, bottom: 50, left: 60};
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const weekdayData = behaviorData.filter(d => d.dayType === "weekday");
    const weekendData = behaviorData.filter(d => d.dayType === "weekend");

    const x = d3.scaleLinear()
        .domain([22, 27])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(behaviorData, d => d.peopleCount)])
        .range([height, 0]);

    // 网格
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSize(-height).tickFormat(""))
        .style("stroke-opacity", 0.1);

    // 轴
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x)
            .tickValues([22, 22.5, 23, 23.5, 24, 24.5, 25, 25.5, 26, 26.5, 27])
            .tickFormat(d => {
                const minutes = (d % 1) * 60;
                let hour = Math.floor(d);
                if (hour >= 24) {
                    hour = hour - 24;
                }
                return hour + ":" + (minutes === 0 ? "00" : "30");
            }))
        .attr("class", "axis");

    svg.append("g")
        .call(d3.axisLeft(y))
        .attr("class", "axis");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .attr("fill", COLORS.text)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .text("时间");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -45)
        .attr("x", -height / 2)
        .attr("fill", COLORS.text)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .text("在线人数");

    // 线条生成器
    const line = d3.line()
        .x(d => x(d.hour > 3 ? d.hour : d.hour + 24))
        .y(d => y(d.peopleCount))
        .curve(d3.curveMonotoneX);

    // 绘制工作日线
    svg.append("path")
        .datum(weekdayData)
        .attr("d", line)
        .style("fill", "none")
        .style("stroke", COLORS.primary)
        .style("stroke-width", 2.5);

    // 绘制周末线
    svg.append("path")
        .datum(weekendData)
        .attr("d", line)
        .style("fill", "none")
        .style("stroke", COLORS.pink)
        .style("stroke-width", 2.5)
        .style("stroke-dasharray", "5,5");

    // 添加交互点
    const allPoints = [
        ...weekdayData.map(d => ({...d, type: 'weekday', color: COLORS.primary})),
        ...weekendData.map(d => ({...d, type: 'weekend', color: COLORS.pink}))
    ];

    svg.selectAll(".trend-point")
        .data(allPoints)
        .enter()
        .append("circle")
        .attr("class", "trend-point")
        .attr("cx", d => x(d.hour > 3 ? d.hour : d.hour + 24))
        .attr("cy", d => y(d.peopleCount))
        .attr("r", 4)
        .style("fill", d => d.color)
        .style("stroke", "#fff")
        .style("stroke-width", 1)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            // 放大当前点
            d3.select(this)
                .transition().duration(200)
                .attr("r", 8)
                .style("stroke-width", 3);

            // 显示 Tooltip
            showTooltip(event, `
                <div class="tooltip-title">${d.hour}:00 (${d.type === 'weekday' ? '工作日' : '周末'})</div>
                <div class="tooltip-row">
                    <span>在线人数:</span>
                    <span>${d.peopleCount}</span>
                </div>
            `);

            // 联动热力图：高亮对应时间的方块
            const heatmapRects = d3.select("#heatmap-chart").selectAll(`rect[data-hour='${d.hour}']`);
            
            heatmapRects
                .transition().duration(200)
                .style("stroke", "#fff")
                .style("stroke-width", 2)
                .style("filter", "brightness(1.3)");
        })
        .on("mouseout", function(event, d) {
            // 恢复当前点
            d3.select(this)
                .transition().duration(200)
                .attr("r", 4)
                .style("stroke-width", 1);

            hideTooltip();

            // 恢复热力图
            const heatmapRects = d3.select("#heatmap-chart").selectAll(`rect[data-hour='${d.hour}']`);
            
            heatmapRects
                .transition().duration(200)
                .style("stroke", "#0a0e1a")
                .style("stroke-width", 1)
                .style("filter", "none");
        });

    // 图例
    const legend = svg.append("g").attr("transform", `translate(${width - 100}, 10)`);
    
    const legendData = [
        { label: "工作日", color: COLORS.primary, dash: false },
        { label: "周末", color: COLORS.pink, dash: true }
    ];

    legendData.forEach((item, i) => {
        const g = legend.append("g").attr("transform", `translate(0,${i * 20})`);
        g.append("line")
            .attr("x1", 0)
            .attr("x2", 20)
            .attr("y1", 6)
            .attr("y2", 6)
            .style("stroke", item.color)
            .style("stroke-width", 2.5)
            .style("stroke-dasharray", item.dash ? "5,5" : "none");
        g.append("text")
            .attr("x", 25)
            .attr("y", 10)
            .text(item.label)
            .style("fill", COLORS.text)
            .style("font-size", "11px");
    });
}

// ===== 工具函数 =====
function showTooltip(event, html) {
    tooltip.style("opacity", 1).html(html);
    
    // 使用 clientX/clientY 因为 tooltip 使用 position: fixed
    let x = event.clientX + 15;
    let y = event.clientY - 15;
    
    // 获取提示框尺寸
    const tooltipNode = tooltip.node();
    const tooltipRect = tooltipNode.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;
    
    // 边界检测 - 防止超出右边界
    if (x + tooltipWidth > window.innerWidth) {
        x = event.clientX - tooltipWidth - 15;
    }
    
    // 边界检测 - 防止超出底部边界
    if (y + tooltipHeight > window.innerHeight) {
        y = event.clientY - tooltipHeight - 15;
    }
    
    // 边界检测 - 防止超出左边界
    if (x < 0) {
        x = 15;
    }
    
    // 边界检测 - 防止超出顶部边界
    if (y < 0) {
        y = 15;
    }
    
    tooltip.style("left", x + "px").style("top", y + "px");
}

function hideTooltip() {
    tooltip.style("opacity", 0);
}

// 窗口调整
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        const activePage = d3.select(".page-section.active").attr("id");
        if (activePage === "page-overview") {
            drawScatter();
            drawRadar(null);
            drawStackedBar();
            drawStressSleepChart();
        } else if (activePage === "page-behavior") {
            const activeType = d3.select('[data-type].active').node()?.dataset.type || "weekday";
            drawHeatmap(activeType);
            drawClockChart();
            drawActivityPie();
            drawHourlyTrend();
        } else if (activePage === "page-health") {
            const activeAge = d3.select('#ageGroupFilter').node()?.value || "all";
            drawSocialImpact(activeAge);
            drawAgeUsage();
            drawHoursSleep();
            drawAddiction();
        } else if (activePage === "page-global") {
            drawWorldMap();
            drawGlobalRanking();
            drawRegionChart();
        }
    }, 300);
});

// ===== 第三页：健康影响分析 =====
function initHealthPage() {
    drawSocialImpact("all");
    drawAgeUsage();
    drawHoursSleep();
    drawAddiction();
    
    // 绑定年龄筛选器
    d3.select("#ageGroupFilter").on("change", function() {
        drawSocialImpact(this.value);
    });
}

// 社交媒体对睡眠的影响
function drawSocialImpact(ageGroup) {
    const container = d3.select("#social-impact-chart");
    container.selectAll("*").remove();

    let data = ageGroup === "all" ? socialData : socialData.filter(d => d.ageGroup === ageGroup);
    
    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const margin = {top: 20, right: 160, bottom: 60, left: 60};
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 按平台分组
    const platforms = Array.from(new Set(data.map(d => d.platform)));
    const groupedData = platforms.map(platform => {
        const platformData = data.filter(d => d.platform === platform);
        return {
            platform,
            avgUsage: d3.mean(platformData, d => d.lateNightUsage),
            avgSleep: d3.mean(platformData, d => d.sleepQuality)
        };
    });

    const x = d3.scaleBand()
        .domain(platforms)
        .range([0, width])
        .padding(0.3);

    const colorScale = d3.scaleOrdinal()
        .domain(platforms)
        .range(d3.schemeTableau10);

    const y1 = d3.scaleLinear()
        .domain([0, 100])
        .range([height, 0]);

    const y2 = d3.scaleLinear()
        .domain([0, 10])
        .range([height, 0]);

    // 网格
    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y1).tickSize(-width).tickFormat(""))
        .style("stroke-opacity", 0.1);

    // 绘制柱状图（深夜使用率）
    svg.selectAll(".bar")
        .data(groupedData)
        .join("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.platform))
        .attr("y", d => y1(d.avgUsage))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y1(d.avgUsage))
        .attr("fill", d => colorScale(d.platform))
        .attr("opacity", 0.7)
        .on("mouseover", function(event, d) {
            showTooltip(event, `
                <div class="tooltip-title">${d.platform}</div>
                <div class="tooltip-row">
                    <span>深夜使用率:</span>
                    <span>${d.avgUsage.toFixed(1)}%</span>
                </div>
                <div class="tooltip-row">
                    <span>睡眠质量:</span>
                    <span>${d.avgSleep.toFixed(1)}/10</span>
                </div>
            `);
            d3.select(this).attr("opacity", 0.95);
        })
        .on("mouseout", function() {
            hideTooltip();
            d3.select(this).attr("opacity", 0.7);
        });

    // 绘制折线图（睡眠质量）
    const line = d3.line()
        .x(d => x(d.platform) + x.bandwidth() / 2)
        .y(d => y2(d.avgSleep))
        .curve(d3.curveMonotoneX);

    svg.append("path")
        .datum(groupedData)
        .attr("d", line)
        .style("fill", "none")
        .style("stroke", COLORS.success)
        .style("stroke-width", 3);

    svg.selectAll(".dot")
        .data(groupedData)
        .join("circle")
        .attr("class", "dot")
        .attr("cx", d => x(d.platform) + x.bandwidth() / 2)
        .attr("cy", d => y2(d.avgSleep))
        .attr("r", 5)
        .attr("fill", COLORS.success)
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);

    // X轴
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .attr("class", "axis")
        .selectAll("text")
        .attr("transform", "rotate(-15)")
        .style("text-anchor", "end");

    // Y轴（左）
    svg.append("g")
        .call(d3.axisLeft(y1).tickFormat(d => d + "%"))
        .attr("class", "axis");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -45)
        .attr("x", -height / 2)
        .attr("fill", COLORS.pink)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .text("深夜使用率 (%)");

    // Y轴（右）
    svg.append("g")
        .attr("transform", `translate(${width},0)`)
        .call(d3.axisRight(y2))
        .attr("class", "axis");

    // 图例（平台颜色 + 睡眠质量线）
    const legend = svg.append("g").attr("transform", `translate(${width + 20}, 10)`);
    platforms.forEach((platform, i) => {
        const g = legend.append("g").attr("transform", `translate(0,${i * 18})`);
        g.append("rect")
            .attr("x", 0)
            .attr("y", -6)
            .attr("width", 12)
            .attr("height", 12)
            .attr("rx", 2)
            .style("fill", colorScale(platform));
        g.append("text")
            .attr("x", 18)
            .attr("y", 4)
            .text(platform)
            .style("fill", COLORS.text)
            .style("font-size", "11px");
    });

    const lineLegend = legend.append("g").attr("transform", `translate(0,${platforms.length * 18 + 10})`);
    lineLegend.append("line")
        .attr("x1", 0)
        .attr("x2", 16)
        .attr("y1", 4)
        .attr("y2", 4)
        .style("stroke", COLORS.success)
        .style("stroke-width", 3);
    lineLegend.append("text")
        .attr("x", 20)
        .attr("y", 8)
        .text("睡眠质量")
        .style("fill", COLORS.text)
        .style("font-size", "11px");
}

// 各年龄段深夜使用率
function drawAgeUsage() {
    const container = d3.select("#age-usage-chart");
    container.selectAll("*").remove();

    // 按年龄组统计平均深夜使用率
    const ageGroups = Array.from(new Set(socialData.map(d => d.ageGroup)));
    const ageData = ageGroups.map(age => ({
        ageGroup: age,
        avgUsage: d3.mean(socialData.filter(d => d.ageGroup === age), d => d.lateNightUsage)
    })).sort((a, b) => {
        const order = {"18-24": 1, "25-34": 2, "35-44": 3, "45+": 4};
        return order[a.ageGroup] - order[b.ageGroup];
    });

    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const margin = {top: 20, right: 30, bottom: 40, left: 60};
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(ageData.map(d => d.ageGroup))
        .range([0, width])
        .padding(0.4);

    const y = d3.scaleLinear()
        .domain([0, 100])
        .range([height, 0]);

    const colorScale = d3.scaleOrdinal()
        .domain(["18-24", "25-34", "35-44", "45+"])
        .range([COLORS.danger, COLORS.tertiary, COLORS.secondary, COLORS.success]);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .attr("class", "axis");

    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d => d + "%"))
        .attr("class", "axis");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 35)
        .attr("fill", COLORS.text)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .text("年龄段");

    svg.selectAll(".bar")
        .data(ageData)
        .join("rect")
        .attr("x", d => x(d.ageGroup))
        .attr("y", d => y(d.avgUsage))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.avgUsage))
        .attr("fill", d => colorScale(d.ageGroup))
        .attr("rx", 5)
        .on("mouseover", function(event, d) {
            showTooltip(event, `
                <div class="tooltip-title">${d.ageGroup}</div>
                <div class="tooltip-row">
                    <span>平均深夜使用率:</span>
                    <span>${d.avgUsage.toFixed(1)}%</span>
                </div>
            `);
            d3.select(this).attr("opacity", 0.8);
        })
        .on("mouseout", function() {
            hideTooltip();
            d3.select(this).attr("opacity", 1);
        });

    // 添加数值标签
    svg.selectAll(".label")
        .data(ageData)
        .join("text")
        .attr("x", d => x(d.ageGroup) + x.bandwidth() / 2)
        .attr("y", d => y(d.avgUsage) - 5)
        .attr("text-anchor", "middle")
        .style("fill", COLORS.text)
        .style("font-size", "12px")
        .style("font-weight", "600")
        .text(d => d.avgUsage.toFixed(0) + "%");

    // 图例
    const legend = svg.append("g").attr("transform", `translate(${width - 100}, 10)`);
    const legendAgeGroups = ["18-24", "25-34", "35-44", "45+"];
    
    legendAgeGroups.forEach((age, i) => {
        const g = legend.append("g").attr("transform", `translate(0,${i * 20})`);
        g.append("circle")
            .attr("cx", 6)
            .attr("cy", 6)
            .attr("r", 5)
            .style("fill", colorScale(age))
            .style("stroke", "#fff")
            .style("stroke-width", 1);
        g.append("text")
            .attr("x", 15)
            .attr("y", 10)
            .text(age)
            .style("fill", COLORS.text)
            .style("font-size", "10px");
    });
}

// 使用时长与睡眠质量关系
function drawHoursSleep() {
    const container = d3.select("#hours-sleep-chart");
    container.selectAll("*").remove();

    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const margin = {top: 20, right: 30, bottom: 50, left: 60};
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([0, d3.max(socialData, d => d.dailyHours) + 0.5])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, 10])
        .range([height, 0]);

    const colorScale = d3.scaleOrdinal()
        .domain(["18-24", "25-34", "35-44", "45+"])
        .range([COLORS.danger, COLORS.tertiary, COLORS.secondary, COLORS.success]);

    // 网格
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSize(-height).tickFormat(""))
        .style("stroke-opacity", 0.1);

    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(""))
        .style("stroke-opacity", 0.1);

    // 轴
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .attr("class", "axis");

    svg.append("g")
        .call(d3.axisLeft(y))
        .attr("class", "axis");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .attr("fill", COLORS.text)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .text("日均使用时长 (小时)");

    // 绘制散点
    svg.selectAll("circle")
        .data(socialData)
        .join("circle")
        .attr("cx", d => x(d.dailyHours))
        .attr("cy", d => y(d.sleepQuality))
        .attr("r", 7)
        .attr("fill", d => colorScale(d.ageGroup))
        .attr("opacity", 0.75)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
            showTooltip(event, `
                <div class="tooltip-title">${d.platform} - ${d.ageGroup}</div>
                <div class="tooltip-row">
                    <span>日均使用:</span>
                    <span>${d.dailyHours}小时</span>
                </div>
                <div class="tooltip-row">
                    <span>睡眠质量:</span>
                    <span>${d.sleepQuality}/10</span>
                </div>
                <div class="tooltip-row">
                    <span>平均睡眠:</span>
                    <span>${d.avgSleep}小时</span>
                </div>
            `);
            d3.select(this).attr("opacity", 1).attr("stroke-width", 2);
        })
        .on("mouseout", function() {
            hideTooltip();
            d3.select(this).attr("opacity", 0.75).attr("stroke-width", 1);
        });

    // 图例
    const legend = svg.append("g").attr("transform", `translate(${width - 100}, 10)`);
    const ageGroups = ["18-24", "25-34", "35-44", "45+"];
    
    ageGroups.forEach((age, i) => {
        const g = legend.append("g").attr("transform", `translate(0,${i * 20})`);
        g.append("circle")
            .attr("cx", 6)
            .attr("cy", 6)
            .attr("r", 5)
            .style("fill", colorScale(age))
            .style("opacity", 0.75)
            .style("stroke", "#fff")
            .style("stroke-width", 1);
        g.append("text")
            .attr("x", 15)
            .attr("y", 10)
            .text(age)
            .style("fill", COLORS.text)
            .style("font-size", "10px");
    });
}

// 平台成瘾指数对比 - 径向条形图 (Radial Bar Chart / Activity Rings)
function drawAddiction() {
    const container = d3.select("#addiction-chart");
    container.selectAll("*").remove();

    // 按平台计算平均成瘾指数
    const platforms = Array.from(new Set(socialData.map(d => d.platform)));
    const addictionData = platforms.map(platform => ({
        platform,
        addiction: d3.mean(socialData.filter(d => d.platform === platform), d => d.addiction)
    })).sort((a, b) => b.addiction - a.addiction); // 降序排列

    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const width = containerWidth;
    const height = containerHeight;
    const radius = Math.min(width, height) / 2;

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    // 环形参数
    const numRings = addictionData.length;
    const ringWidth = 12;
    const gap = 8;
    const innerRadius = 30;
    
    // 角度比例尺 (0-5分 映射到 0-270度，留出缺口放图例或文字)
    const maxScore = 5; // 假设满分是5
    const angleScale = d3.scaleLinear()
        .domain([0, maxScore]) 
        .range([0, 1.5 * Math.PI]); // 270度

    const colorScale = d3.scaleOrdinal()
        .domain(platforms)
        .range(d3.schemeTableau10);

    // 绘制环形
    addictionData.forEach((d, i) => {
        // 外圈是最大值，内圈是最小值，或者反过来
        // 这里让最大值在最外圈，视觉上更明显
        const r = innerRadius + (numRings - 1 - i) * (ringWidth + gap);
        
        // 背景环
        const bgArc = d3.arc()
            .innerRadius(r)
            .outerRadius(r + ringWidth)
            .startAngle(0)
            .endAngle(1.5 * Math.PI)
            .cornerRadius(ringWidth / 2);
            
        svg.append("path")
            .attr("d", bgArc)
            .style("fill", "#333")
            .style("opacity", 0.3);
            
        // 数值环
        const valArc = d3.arc()
            .innerRadius(r)
            .outerRadius(r + ringWidth)
            .startAngle(0)
            .endAngle(angleScale(d.addiction))
            .cornerRadius(ringWidth / 2);
            
        svg.append("path")
            .attr("d", valArc)
            .style("fill", colorScale(d.platform))
            .on("mouseover", (event) => {
                 showTooltip(event, `
                    <div class="tooltip-title">${d.platform}</div>
                    <div class="tooltip-row">
                        <span>成瘾指数:</span>
                        <span>${d.addiction.toFixed(1)}/5</span>
                    </div>
                `);
                 d3.select(event.currentTarget).style("opacity", 0.8);
            })
            .on("mouseout", (event) => {
                hideTooltip();
                d3.select(event.currentTarget).style("opacity", 1);
            });

        // 在环的起点添加图标或文字
        // 这里简单添加文字标签在环的左侧（缺口处）
        // 计算缺口处的坐标
        // 270度缺口在左上角 (1.5 PI) 到 0度 (12点钟? 不，d3 arc 0度是12点钟顺时针)
        // d3.arc 0 is at 12 o'clock usually? No, 0 is at 12 o'clock if we rotate?
        // Standard d3.arc: 0 is up (12 o'clock), PI/2 is right (3 o'clock).
        // Wait, standard math 0 is right. d3.arc 0 is 12 o'clock.
        // Let's check d3 docs mentally: 0 is 12 o'clock.
        // So 0 to 1.5 PI is 12 -> 3 -> 6 -> 9. The gap is 9 to 12 (top-left).
        
        // Let's put labels in the gap area.
        svg.append("text")
            .attr("x", -10) 
            .attr("y", -r - ringWidth/2 + 4) // 垂直对齐到环中心
            .attr("text-anchor", "end")
            .text(d.platform)
            .style("fill", COLORS.text)
            .style("font-size", "10px")
            .style("font-weight", "bold");
            
        // 在环的终点添加数值
        const endAngle = angleScale(d.addiction);
        const centroid = d3.arc()
            .innerRadius(r)
            .outerRadius(r + ringWidth)
            .startAngle(endAngle - 0.1) // slightly back
            .endAngle(endAngle)
            .centroid();
            
        // 如果数值太小，文字可能会重叠，这里简化处理
        // 也可以把数值放在标签旁边
        svg.append("text")
            .attr("x", -10)
            .attr("y", -r - ringWidth/2 + 14) // 标签下方
            .attr("text-anchor", "end")
            .text(d.addiction.toFixed(1))
            .style("fill", colorScale(d.platform))
            .style("font-size", "9px");
    });
    
    // 中心添加标题
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .text("成瘾指数")
        .style("fill", COLORS.text)
        .style("font-size", "12px")
        .style("font-weight", "bold");
}

// ===== 第四页：全球对比 =====
function initGlobalPage() {
    drawWorldMap();
    drawGlobalRanking();
    drawRegionChart();
    // drawGlobalBubble(); // 已注释，不再使用
    
    // 绑定排序按钮
    d3.select("#sortAsc").on("click", function() {
        d3.selectAll("#sortAsc, #sortDesc").classed("active", false);
        d3.select(this).classed("active", true);
        drawGlobalRanking(true);
    });
    
    d3.select("#sortDesc").on("click", function() {
        d3.selectAll("#sortAsc, #sortDesc").classed("active", false);
        d3.select(this).classed("active", true);
        drawGlobalRanking(false);
    });
}

// 全球熬夜率地图
function drawWorldMap() {
    const container = d3.select("#global-map-chart");
    if (container.empty()) return;

    container.selectAll("*").remove();

    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const margin = { top: 6, right: 6, bottom: 6, left: 6 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const normalizeName = name => (name || "").toLowerCase().replace(/[^a-z]/g, "");
    const NAME_ALIASES = {
        "unitedstatesofamerica": "unitedstates",
        "unitedstates": "unitedstates",
        "republicofkorea": "southkorea",
        "korearepublicof": "southkorea",
        "viet nam": "vietnam"
    };

    const dataMap = new Map(globalData.map(d => [normalizeName(d.country), d]));
    const lateNightExtent = d3.extent(globalData, d => d.lateNightRate);
    const colorScale = d3.scaleLinear()
        .domain(lateNightExtent)
        .range([COLORS.success, COLORS.danger])
        .clamp(true);

    const renderMap = (geojson) => {
        const radius = Math.min(width, height) / 2;
        const projection = d3.geoOrthographic()
            .translate([width / 2, height / 2])
            .scale(radius - 4)
            .rotate(worldRotation);

        const path = d3.geoPath(projection);
        const graticule = d3.geoGraticule();
        const sphere = { type: "Sphere" };

        const ocean = svg.append("path")
            .datum(sphere)
            .attr("fill", "#0f172a")
            .attr("stroke", COLORS.secondary)
            .attr("stroke-opacity", 0.25);

        const graticulePath = svg.append("path")
            .datum(graticule())
            .attr("fill", "none")
            .attr("stroke", "rgba(255,255,255,0.08)")
            .attr("stroke-width", 0.6);

        const countries = svg.append("g")
            .attr("cursor", "grab")
            .selectAll("path")
            .data(geojson.features)
            .join("path")
            .attr("fill", d => {
                const key = normalizeName(d.properties?.name);
                const alias = NAME_ALIASES[key];
                const data = dataMap.get(key) || dataMap.get(alias);
                return data ? colorScale(data.lateNightRate) : "#1f2937";
            })
            .attr("stroke", "#0a0e1a")
            .attr("stroke-width", 0.7)
            .on("mouseover", (event, d) => {
                const key = normalizeName(d.properties?.name);
                const alias = NAME_ALIASES[key];
                const data = dataMap.get(key) || dataMap.get(alias);
                const hasData = Boolean(data);

                d3.select(event.currentTarget)
                    .attr("stroke", COLORS.primary)
                    .attr("stroke-width", 1.6)
                    .raise();

                showTooltip(event, `
                    <div class="tooltip-title">${d.properties?.name || "未知国家"}</div>
                    <div class="tooltip-row">
                        <span>熬夜率:</span>
                        <span>${hasData ? `${data.lateNightRate}%` : "暂无数据"}</span>
                    </div>
                    <div class="tooltip-row">
                        <span>平均睡眠:</span>
                        <span>${hasData ? `${data.avgSleep} 小时` : "暂无数据"}</span>
                    </div>
                    <div class="tooltip-row">
                        <span>周工作时长:</span>
                        <span>${hasData ? `${data.workHours} 小时` : "暂无数据"}</span>
                    </div>
                    <div class="tooltip-row">
                        <span>网络使用:</span>
                        <span>${hasData ? `${data.internetHours} 小时/天` : "暂无数据"}</span>
                    </div>
                    ${hasData ? `<div class="tooltip-row">
                        <span>压力水平:</span>
                        <span>${data.stressLevel}/10</span>
                    </div>
                    <div class="tooltip-row">
                        <span>睡眠障碍率:</span>
                        <span>${data.disorderRate}%</span>
                    </div>` : ""}
                `);
            })
            .on("mouseout", (event) => {
                hideTooltip();
                d3.select(event.currentTarget)
                    .attr("stroke", "#0a0e1a")
                    .attr("stroke-width", 0.7);
            });

        const redraw = () => {
            ocean.attr("d", path);
            graticulePath.attr("d", path);
            countries.attr("d", path);
        };

        redraw();

        const drag = d3.drag()
            .on("start", () => countries.attr("cursor", "grabbing"))
            .on("drag", (event) => {
                const sensitivity = 0.4;
                worldRotation[0] += event.dx * sensitivity;
                worldRotation[1] -= event.dy * sensitivity;
                worldRotation[1] = Math.max(-90, Math.min(90, worldRotation[1]));
                projection.rotate(worldRotation);
                redraw();
            })
            .on("end", () => countries.attr("cursor", "grab"));

        svg.call(drag);

        // 图例渲染到HTML容器
        const legendContainer = d3.select("#globe-legend");
        legendContainer.html("");
        
        const svgLegend = legendContainer.append("svg")
            .attr("width", 180)
            .attr("height", 24);
        
        const defsLegend = svgLegend.append("defs");
        const gradientLegend = defsLegend.append("linearGradient")
            .attr("id", "map-gradient-legend")
            .attr("x1", "0%")
            .attr("x2", "100%");
        
        gradientLegend.append("stop").attr("offset", "0%").attr("stop-color", COLORS.success);
        gradientLegend.append("stop").attr("offset", "100%").attr("stop-color", COLORS.danger);
        
        svgLegend.append("rect")
            .attr("x", 20)
            .attr("y", 4)
            .attr("width", 120)
            .attr("height", 10)
            .attr("fill", "url(#map-gradient-legend)")
            .attr("stroke", COLORS.primary)
            .attr("stroke-width", 1);
        
        svgLegend.append("text")
            .attr("x", 18)
            .attr("y", 20)
            .style("fill", COLORS.text)
            .style("font-size", "11px")
            .style("text-anchor", "end")
            .text("低");
        
        svgLegend.append("text")
            .attr("x", 142)
            .attr("y", 20)
            .style("fill", COLORS.text)
            .style("font-size", "11px")
            .style("text-anchor", "start")
            .text("高");
    };

    if (worldGeoData) {
        renderMap(worldGeoData);
    } else {
        d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
            .then(world => {
                worldGeoData = topojson.feature(world, world.objects.countries);
                renderMap(worldGeoData);
            })
            .catch(err => {
                console.error("世界地图加载失败", err);
                container.append("div")
                    .style("color", COLORS.text)
                    .style("padding", "10px")
                    .text("世界地图加载失败，请检查网络连接。");
            });
    }
}

// 全球睡眠时长排名
function drawGlobalRanking(ascending = true) {
    const container = d3.select("#global-ranking-chart");
    container.selectAll("*").remove();

    const sortedData = [...globalData].sort((a, b) => 
        ascending ? a.avgSleep - b.avgSleep : b.avgSleep - a.avgSleep
    );

    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const margin = {top: 20, right: 30, bottom: 40, left: 120};
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([0, 8])
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(sortedData.map(d => d.country))
        .range([0, height])
        .padding(0.08);

    const colorScale = d3.scaleSequential()
        .domain([6, 8])
        .interpolator(d3.interpolateRgb(COLORS.danger, COLORS.success));

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .attr("class", "axis");

    svg.append("g")
        .call(d3.axisLeft(y))
        .attr("class", "axis")
        .selectAll("text")
        .style("font-size", "10px");

    svg.selectAll(".bar")
        .data(sortedData)
        .join("rect")
        .attr("x", 0)
        .attr("y", d => y(d.country))
        .attr("width", d => x(d.avgSleep))
        .attr("height", y.bandwidth())
        .attr("fill", d => colorScale(d.avgSleep))
        .attr("rx", 3)
        .on("mouseover", function(event, d) {
            showTooltip(event, `
                <div class="tooltip-title">${d.country}</div>
                <div class="tooltip-row">
                    <span>平均睡眠:</span>
                    <span>${d.avgSleep}小时</span>
                </div>
                <div class="tooltip-row">
                    <span>熬夜率:</span>
                    <span>${d.lateNightRate}%</span>
                </div>
                <div class="tooltip-row">
                    <span>周工作时长:</span>
                    <span>${d.workHours}小时</span>
                </div>
            `);
            d3.select(this).attr("opacity", 0.8);
        })
        .on("mouseout", function() {
            hideTooltip();
            d3.select(this).attr("opacity", 1);
        });

    // 数值标签
    svg.selectAll(".label")
        .data(sortedData)
        .join("text")
        .attr("x", d => x(d.avgSleep) + 5)
        .attr("y", d => y(d.country) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .style("fill", COLORS.text)
        .style("font-size", "10px")
        .style("font-weight", "600")
        .text(d => d.avgSleep + "h");

    // 渐变图例（睡眠时长）- 渲染到HTML容器
    const legendContainer = d3.select("#ranking-legend");
    legendContainer.html("");
    
    const svgLegend = legendContainer.append("svg")
        .attr("width", 160)
        .attr("height", 24);
    
    const defsLegend = svgLegend.append("defs");
    const gradientLegend = defsLegend.append("linearGradient")
        .attr("id", "ranking-gradient-legend")
        .attr("x1", "0%")
        .attr("x2", "100%");
    
    gradientLegend.append("stop").attr("offset", "0%").attr("stop-color", COLORS.danger);
    gradientLegend.append("stop").attr("offset", "100%").attr("stop-color", COLORS.success);
    
    svgLegend.append("rect")
        .attr("x", 20)
        .attr("y", 4)
        .attr("width", 100)
        .attr("height", 10)
        .attr("fill", "url(#ranking-gradient-legend)")
        .attr("stroke", COLORS.primary)
        .attr("stroke-width", 1)
        .attr("rx", 2);
    
    svgLegend.append("text")
        .attr("x", 18)
        .attr("y", 20)
        .style("fill", COLORS.text)
        .style("font-size", "10px")
        .style("text-anchor", "end")
        .text("较短");
    
    svgLegend.append("text")
        .attr("x", 122)
        .attr("y", 20)
        .style("fill", COLORS.text)
        .style("font-size", "10px")
        .style("text-anchor", "start")
        .text("较长");
}

// 地区熬夜率对比
// 树状热力图 (Treemap) - 各地区及国家熬夜率分层展示（优化版）
function drawRegionChart() {
    const container = d3.select("#region-chart");
    container.selectAll("*").remove();

    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const margin = {top: 60, right: 15, bottom: 15, left: 15};
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    // 构建层级数据结构
    const hierarchyData = {
        name: "全球",
        children: []
    };

    const regions = Array.from(new Set(globalData.map(d => d.region)));
    regions.forEach(region => {
        const regionCountries = globalData.filter(d => d.region === region);
        hierarchyData.children.push({
            name: region,
            children: regionCountries.map(d => ({
                name: d.country,
                value: d.lateNightRate,
                sleep: d.avgSleep,
                stress: d.stressLevel,
                disorder: d.disorderRate,
                workHours: d.workHours,
                internetHours: d.internetHours
            }))
        });
    });

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 创建层级结构
    const root = d3.hierarchy(hierarchyData)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);

    // 创建treemap布局
    d3.treemap()
        .size([width, height])
        .paddingTop(28)
        .paddingInner(3)
        .paddingOuter(4)
        .round(true)
        (root);

    // 颜色比例尺 - 根据熬夜率着色，使用更丰富的渐变
    const colorScale = d3.scaleSequential()
        .domain([25, 75])
        .interpolator(d3.interpolateRgb("#10b981", "#ef4444"));

    // 地区颜色 - 顶部标签
    const regionColors = {
        "Asia": COLORS.danger,
        "Europe": COLORS.primary,
        "North America": COLORS.tertiary,
        "South America": COLORS.secondary,
        "Oceania": COLORS.success
    };

    // 添加滤镜和阴影效果
    const defs = svg.append("defs");
    
    // 发光滤镜
    const filter = defs.append("filter")
        .attr("id", "glow");
    filter.append("feGaussianBlur")
        .attr("stdDeviation", "3")
        .attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // 渐变图例
    const gradient = defs.append("linearGradient")
        .attr("id", "treemap-gradient")
        .attr("x1", "0%")
        .attr("x2", "100%");

    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#10b981");

    gradient.append("stop")
        .attr("offset", "33%")
        .attr("stop-color", "#22c55e");

    gradient.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", "#f59e0b");

    gradient.append("stop")
        .attr("offset", "75%")
        .attr("stop-color", "#f97316");

    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#ef4444");

    // 绘制节点组
    const nodes = svg.selectAll(".country-node")
        .data(root.leaves())
        .join("g")
        .attr("class", "country-node")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    // 绘制矩形
    nodes.append("rect")
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr("fill", d => colorScale(d.data.value))
        .attr("stroke", "#0a0e1a")
        .attr("stroke-width", 2.5)
        .attr("rx", 4)
        .style("opacity", 0.85)
        .style("transition", "all 0.3s ease")
        .on("mouseover", function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .style("opacity", 1)
                .attr("stroke", COLORS.primary)
                .attr("stroke-width", 4)
                .style("filter", "url(#glow)");

            // 高亮该国家所在的地区标签
            d3.selectAll(".region-label")
                .filter(r => r.data.name === d.parent.data.name)
                .selectAll("text")
                .transition()
                .duration(200)
                .style("font-size", "15px");

            showTooltip(event, `
                <div class="tooltip-title">${d.data.name}</div>
                <div class="tooltip-row">
                    <span>所属地区:</span>
                    <span>${d.parent.data.name}</span>
                </div>
                <div class="tooltip-row">
                    <span>熬夜率:</span>
                    <span style="color: ${colorScale(d.data.value)}; font-weight: bold;">${d.data.value.toFixed(1)}%</span>
                </div>
                <div class="tooltip-row">
                    <span>平均睡眠:</span>
                    <span>${d.data.sleep.toFixed(1)}小时</span>
                </div>
                <div class="tooltip-row">
                    <span>压力等级:</span>
                    <span>${d.data.stress.toFixed(1)}/10</span>
                </div>
                <div class="tooltip-row">
                    <span>工作时长:</span>
                    <span>${d.data.workHours}小时/周</span>
                </div>
                <div class="tooltip-row">
                    <span>互联网使用:</span>
                    <span>${d.data.internetHours.toFixed(1)}小时/天</span>
                </div>
                <div class="tooltip-row">
                    <span>睡眠障碍率:</span>
                    <span>${d.data.disorder.toFixed(1)}%</span>
                </div>
            `);
        })
        .on("mouseout", function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .style("opacity", 0.85)
                .attr("stroke", "#0a0e1a")
                .attr("stroke-width", 2.5)
                .style("filter", "none");

            d3.selectAll(".region-label")
                .filter(r => r.data.name === d.parent.data.name)
                .selectAll("text")
                .transition()
                .duration(200)
                .style("font-size", "13px");

            hideTooltip();
        });

    // 添加国家名称
    nodes.append("text")
        .attr("x", d => (d.x1 - d.x0) / 2)
        .attr("y", d => (d.y1 - d.y0) / 2 - 6)
        .style("fill", COLORS.bg)
        .style("font-size", d => {
            const width = d.x1 - d.x0;
            const height = d.y1 - d.y0;
            return Math.min(width / 5, height / 3, 14) + "px";
        })
        .style("font-weight", "bold")
        .style("text-anchor", "middle")
        .style("pointer-events", "none")
        .style("text-shadow", "1px 1px 2px rgba(0,0,0,0.5)")
        .text(d => {
            const width = d.x1 - d.x0;
            const name = d.data.name;
            // 过窄时显示三字简写，保证国家可见
            if (width < 26) return "";
            if (width < 60) return name.substring(0, 3);
            if (name.length > 15) return name.substring(0, 12) + "...";
            return name;
        });

    // 添加熬夜率数值
    nodes.append("text")
        .attr("x", d => (d.x1 - d.x0) / 2)
        .attr("y", d => (d.y1 - d.y0) / 2 + 10)
        .style("fill", COLORS.text)
        .style("font-size", d => {
            const width = d.x1 - d.x0;
            const height = d.y1 - d.y0;
            return Math.min(width / 6, height / 4, 13) + "px";
        })
        .style("font-weight", "700")
        .style("text-anchor", "middle")
        .style("pointer-events", "none")
        .style("text-shadow", "1px 1px 3px rgba(0,0,0,0.8)")
        .text(d => {
            const width = d.x1 - d.x0;
            if (width < 35) return "";
            return d.data.value.toFixed(0) + "%";
        });

    // 绘制地区标签 - 只在文字后添加小背景，不遮挡国家方框
    const regionLabels = svg.selectAll(".region-label")
        .data(root.children)
        .join("g")
        .attr("class", "region-label")
        .attr("transform", d => `translate(${d.x0 + (d.x1 - d.x0) / 2}, ${d.y0 + 13})`);

    // 文字背景（带模糊效果）
    regionLabels.append("text")
        .style("fill", COLORS.bg)
        .style("font-size", "13px")
        .style("font-weight", "bold")
        .style("text-anchor", "middle")
        .style("stroke", COLORS.bg)
        .style("stroke-width", "6px")
        .style("stroke-linejoin", "round")
        .style("paint-order", "stroke")
        .style("opacity", 0.9)
        .style("pointer-events", "none")
        .text(d => d.data.name);

    // 地区名称文字
    regionLabels.append("text")
        .style("fill", d => regionColors[d.data.name] || COLORS.secondary)
        .style("font-size", "13px")
        .style("font-weight", "bold")
        .style("text-anchor", "middle")
        .style("pointer-events", "none")
        .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.5))")
        .text(d => d.data.name);

    // 添加颜色图例
    const legendWidth = 250;
    const legendHeight = 14;
    const legendX = width - legendWidth - 15;
    const legendY = -45;

    svg.append("text")
        .attr("x", legendX + legendWidth / 2)
        .attr("y", legendY)
        .style("fill", COLORS.text)
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("text-anchor", "middle")
        .text("熬夜率热力分布");

    svg.append("rect")
        .attr("x", legendX)
        .attr("y", legendY + 6)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#treemap-gradient)")
        .attr("stroke", COLORS.primary)
        .attr("stroke-width", 1.5)
        .attr("rx", 3);

    svg.append("text")
        .attr("x", legendX - 5)
        .attr("y", legendY + 16)
        .style("fill", COLORS.text)
        .style("font-size", "11px")
        .style("text-anchor", "end")
        .text("25%");

    svg.append("text")
        .attr("x", legendX + legendWidth + 5)
        .attr("y", legendY + 16)
        .style("fill", COLORS.text)
        .style("font-size", "11px")
        .text("75%");

    // 添加统计信息
    const totalCountries = root.leaves().length;
    const avgLateNight = d3.mean(root.leaves(), d => d.data.value);
    
    svg.append("text")
        .attr("x", 10)
        .attr("y", -45)
        .style("fill", COLORS.text)
        .style("font-size", "11px")
        .style("opacity", 0.8)
        .text(`共 ${totalCountries} 个国家 | 平均熬夜率: ${avgLateNight.toFixed(1)}%`);
}

// 全球气泡图 - 已注释，不再使用
/*
function drawGlobalBubble() {
    const container = d3.select("#global-bubble-chart");
    container.selectAll("*").remove();

    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const margin = {top: 20, right: 30, bottom: 60, left: 70};
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([35, 55])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([6, 8])
        .range([height, 0]);

    const size = d3.scaleLinear()
        .domain([0, d3.max(globalData, d => d.internetHours)])
        .range([3, 12]);

    const regions = Array.from(new Set(globalData.map(d => d.region)));
    const colorScale = d3.scaleOrdinal()
        .domain(regions)
        .range([COLORS.danger, COLORS.tertiary, COLORS.secondary, COLORS.primary, COLORS.success]);

    // 网格
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSize(-height).tickFormat(""))
        .style("stroke-opacity", 0.1);

    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(""))
        .style("stroke-opacity", 0.1);

    // 轴
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .attr("class", "axis");

    svg.append("g")
        .call(d3.axisLeft(y))
        .attr("class", "axis");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 45)
        .attr("fill", COLORS.text)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("周工作时长 (小时)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -50)
        .attr("x", -height / 2)
        .attr("fill", COLORS.text)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("平均睡眠时长 (小时)");

    // 绘制气泡
    svg.selectAll("circle")
        .data(globalData)
        .join("circle")
        .attr("cx", d => x(d.workHours))
        .attr("cy", d => y(d.avgSleep))
        .attr("r", d => size(d.internetHours))
        .attr("fill", d => colorScale(d.region))
        .attr("opacity", 0.75)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
            showTooltip(event, `
                <div class="tooltip-title">${d.country}</div>
                <div class="tooltip-row">
                    <span>地区:</span>
                    <span>${d.region}</span>
                </div>
                <div class="tooltip-row">
                    <span>睡眠时长:</span>
                    <span>${d.avgSleep}小时</span>
                </div>
                <div class="tooltip-row">
                    <span>工作时长:</span>
                    <span>${d.workHours}小时/周</span>
                </div>
                <div class="tooltip-row">
                    <span>互联网使用:</span>
                    <span>${d.internetHours}小时/天</span>
                </div>
                <div class="tooltip-row">
                    <span>熬夜率:</span>
                    <span>${d.lateNightRate}%</span>
                </div>
            `);
            d3.select(this)
                .transition()
                .duration(200)
                .attr("opacity", 1)
                .attr("stroke-width", 2);
        })
        .on("mouseout", function(event, d) {
            hideTooltip();
            d3.select(this)
                .transition()
                .duration(200)
                .attr("opacity", 0.75)
                .attr("stroke-width", 1);
        });

    // 图例
    const legend = d3.select("#global-legend");
    legend.html("");
    regions.forEach(region => {
        const item = legend.append("div").attr("class", "legend-item");
        item.append("div")
            .attr("class", "legend-color")
            .style("background", colorScale(region));
        item.append("span").text(region);
    });
}
*/
