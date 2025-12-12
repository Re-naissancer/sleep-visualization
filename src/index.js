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
    healthData = health.map(d => ({
        id: d['Person ID'],
        gender: d.Gender,
        age: +d.Age,
        occupation: d.Occupation,
        sleepDuration: +d['Sleep Duration'],
        sleepQuality: +d['Quality of Sleep'],
        activityLevel: +d['Physical Activity Level'],
        stressLevel: +d['Stress Level'],
        bmi: d['BMI Category'] === "Normal Weight" ? "Normal" : d['BMI Category'],
        heartRate: +d['Heart Rate'],
        steps: +d['Daily Steps'],
        disorder: d['Sleep Disorder'] === "None" ? "No Disorder" : d['Sleep Disorder']
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
    drawDonut();
}

function updateKPIs() {
    const data = filteredHealthData;
    const disorderRate = (data.filter(d => d.disorder !== "No Disorder").length / data.length * 100).toFixed(1);
    
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
        drawDonut();
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
        .domain(["Normal", "Overweight", "Obese"])
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
                .style("stroke-width", 2)
                .attr("r", d.sleepDuration * 2);
            
            drawRadar(d);
        })
        .on("mouseout", (event, d) => {
            hideTooltip();
            d3.select(event.currentTarget)
                .transition()
                .duration(200)
                .style("opacity", 0.6)
                .style("stroke-width", 0.5)
                .attr("r", d.sleepDuration * 1.5);
            
            drawRadar(null);
        });

    // 图例
    const legend = d3.select("#scatter-legend");
    legend.html("");
    ["Normal", "Overweight", "Obese"].forEach(bmi => {
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

    const features = ["睡眠时长", "睡眠质量", "压力水平", "运动量", "心率"];
    const angleSlice = Math.PI * 2 / features.length;

    const normalize = (d) => ({
        "睡眠时长": (d.sleepDuration / 10) * 10,
        "睡眠质量": (d.sleepQuality / 10) * 10,
        "压力水平": (10 - d.stressLevel),
        "运动量": (d.activityLevel / 100) * 10,
        "心率": ((80 - Math.abs(d.heartRate - 70)) / 80) * 10
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
            .style("stroke", "rgba(100, 140, 200, 0.2)")
            .style("stroke-dasharray", "3,3");
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

        svg.append("text")
            .attr("x", rScale(12) * Math.cos(angle))
            .attr("y", rScale(12) * Math.sin(angle))
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

    const groups = ["Normal", "Overweight", "Obese"];
    const subgroups = ["No Disorder", "Sleep Apnea", "Insomnia"];

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
        .domain([0, d3.max(preparedData, d => d["No Disorder"] + d["Sleep Apnea"] + d["Insomnia"])])
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
function drawDonut() {
    const container = d3.select("#donut-chart");
    container.selectAll("*").remove();

    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const radius = Math.min(containerWidth, containerHeight) / 2 - 30;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${containerWidth/2},${containerHeight/2})`);

    const counts = { "低压力(1-4)": 0, "中等压力(5-7)": 0, "高压力(8-10)": 0 };
    filteredHealthData.forEach(d => {
        if(d.stressLevel <= 4) counts["低压力(1-4)"]++;
        else if(d.stressLevel <= 7) counts["中等压力(5-7)"]++;
        else counts["高压力(8-10)"]++;
    });

    const pieData = Object.entries(counts).map(([k, v]) => ({ key: k, value: v }));

    const color = d3.scaleOrdinal()
        .domain(["低压力(1-4)", "中等压力(5-7)", "高压力(8-10)"])
        .range([COLORS.success, COLORS.tertiary, COLORS.danger]);

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.6).outerRadius(radius);

    svg.selectAll("path")
        .data(pie(pieData))
        .join("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data.key))
        .attr("stroke", "#0a0e1a")
        .style("stroke-width", "2px")
        .on("mouseover", (event, d) => {
            const pct = (d.data.value / filteredHealthData.length * 100).toFixed(1);
            showTooltip(event, `
                <div class="tooltip-title">${d.data.key}</div>
                <div class="tooltip-row">
                    <span>人数:</span>
                    <span>${d.data.value} 人</span>
                </div>
                <div class="tooltip-row">
                    <span>占比:</span>
                    <span>${pct}%</span>
                </div>
            `);
            d3.select(event.currentTarget)
                .transition()
                .duration(200)
                .style("opacity", 0.8)
                .attr("d", d3.arc().innerRadius(radius*0.6).outerRadius(radius+8));
        })
        .on("mouseout", (event) => {
            hideTooltip();
            d3.select(event.currentTarget)
                .transition()
                .duration(200)
                .style("opacity", 1)
                .attr("d", arc);
        });

    svg.append("text")
        .text("压力")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.3em")
        .style("fill", COLORS.text)
        .style("font-size", "16px")
        .style("font-weight", "600");
        
    svg.append("text")
        .text("分布")
        .attr("text-anchor", "middle")
        .attr("dy", "1.2em")
        .style("fill", COLORS.text)
        .style("font-size", "16px")
        .style("font-weight", "600");
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

    // 计算每小时平均活跃人数
    const hourlyData = d3.range(0, 24).map(hour => {
        const records = behaviorData.filter(d => d.hour === hour);
        const avgPeople = d3.mean(records, d => d.peopleCount) || 0;
        return { hour, people: avgPeople };
    });

    const angleScale = d3.scaleLinear()
        .domain([0, 24])
        .range([0, 2 * Math.PI]);

    const radiusScale = d3.scaleLinear()
        .domain([0, d3.max(hourlyData, d => d.people)])
        .range([0, radius]);

    // 绘制时钟圆圈
    svg.append("circle")
        .attr("r", radius)
        .style("fill", "none")
        .style("stroke", "rgba(100, 140, 200, 0.2)");

    // 绘制24小时刻度
    hourlyData.forEach(d => {
        const angle = angleScale(d.hour) - Math.PI / 2;
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
            .text(d.hour)
            .style("font-size", "10px")
            .style("fill", COLORS.text);
    });

    // 绘制活跃度区域
    const lineGenerator = d3.lineRadial()
        .angle(d => angleScale(d.hour) - Math.PI / 2)
        .radius(d => radiusScale(d.people))
        .curve(d3.curveCardinalClosed);

    svg.append("path")
        .datum(hourlyData)
        .attr("d", lineGenerator)
        .style("fill", COLORS.primary)
        .style("fill-opacity", 0.3)
        .style("stroke", COLORS.primary)
        .style("stroke-width", 2);

    // 高亮深夜时段 (22:00 - 3:00)
    const nightHours = [22, 23, 0, 1, 2, 3];
    nightHours.forEach(hour => {
        const d = hourlyData.find(item => item.hour === hour);
        const angle = angleScale(d.hour) - Math.PI / 2;
        const r = radiusScale(d.people);
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);

        svg.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", 4)
            .style("fill", COLORS.danger)
            .style("stroke", "#fff")
            .style("stroke-width", 1.5)
            .on("mouseover", function(event) {
                showTooltip(event, `
                    <div class="tooltip-title">${d.hour}:00</div>
                    <div class="tooltip-row">
                        <span>平均在线:</span>
                        <span>${Math.round(d.people)} 人</span>
                    </div>
                `);
            })
            .on("mouseout", hideTooltip);
    });
}

// 活动类型饼图
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

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(0).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(0).outerRadius(radius + 8);

    svg.selectAll("path")
        .data(pie(pieData))
        .join("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data.activity))
        .attr("stroke", "#0a0e1a")
        .style("stroke-width", "2px")
        .on("mouseover", function(event, d) {
            const total = d3.sum(pieData, item => item.value);
            const pct = (d.data.value / total * 100).toFixed(1);
            showTooltip(event, `
                <div class="tooltip-title">${d.data.activity}</div>
                <div class="tooltip-row">
                    <span>占比:</span>
                    <span>${pct}%</span>
                </div>
            `);
            d3.select(this)
                .transition()
                .duration(200)
                .attr("d", arcHover);
        })
        .on("mouseout", function() {
            hideTooltip();
            d3.select(this)
                .transition()
                .duration(200)
                .attr("d", arc);
        });

    // 添加标签
    svg.selectAll("text")
        .data(pie(pieData))
        .join("text")
        .attr("transform", d => {
            const [x, y] = arc.centroid(d);
            return `translate(${x * 1.4},${y * 1.4})`;
        })
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", COLORS.text)
        .style("font-weight", "500")
        .text(d => {
            const total = d3.sum(pieData, item => item.value);
            const pct = (d.data.value / total * 100);
            return pct > 5 ? d.data.activity : "";
        });
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
        .call(d3.axisBottom(x).tickFormat(d => d > 23 ? (d - 24) + ":00" : d + ":00"))
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
            drawDonut();
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
            drawGlobalRanking();
            drawRegionChart();
            drawGlobalBubble();
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
    const margin = {top: 20, right: 30, bottom: 60, left: 60};
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
        .attr("fill", COLORS.pink)
        .attr("opacity", 0.6)
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
            d3.select(this).attr("opacity", 0.8);
        })
        .on("mouseout", function() {
            hideTooltip();
            d3.select(this).attr("opacity", 0.6);
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

    svg.append("text")
        .attr("transform", `rotate(-90)`)
        .attr("y", width + 45)
        .attr("x", -height / 2)
        .attr("fill", COLORS.success)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .text("睡眠质量 (1-10)");

    // 图例
    const legend = svg.append("g").attr("transform", `translate(10, 10)`);
    
    const legendData = [
        { label: "深夜使用率", color: COLORS.pink, type: "rect" },
        { label: "睡眠质量", color: COLORS.success, type: "line" }
    ];

    legendData.forEach((item, i) => {
        const g = legend.append("g").attr("transform", `translate(0,${i * 20})`);
        if (item.type === "rect") {
            g.append("rect")
                .attr("width", 15)
                .attr("height", 15)
                .style("fill", item.color)
                .style("opacity", 0.6);
        } else {
            g.append("line")
                .attr("x1", 0)
                .attr("x2", 15)
                .attr("y1", 7)
                .attr("y2", 7)
                .style("stroke", item.color)
                .style("stroke-width", 3);
        }
        g.append("text")
            .attr("x", 20)
            .attr("y", 12)
            .text(item.label)
            .style("fill", COLORS.text)
            .style("font-size", "11px");
    });
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

    const colorScale = d3.scaleSequential()
        .domain([0, 100])
        .interpolator(d3.interpolateRgb(COLORS.success, COLORS.danger));

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
        .attr("fill", d => colorScale(d.avgUsage))
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

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -45)
        .attr("x", -height / 2)
        .attr("fill", COLORS.text)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .text("睡眠质量 (1-10)");

    // 绘制散点
    svg.selectAll("circle")
        .data(socialData)
        .join("circle")
        .attr("cx", d => x(d.dailyHours))
        .attr("cy", d => y(d.sleepQuality))
        .attr("r", 4)
        .attr("fill", d => colorScale(d.ageGroup))
        .attr("opacity", 0.6)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
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
            d3.select(this).attr("r", 6).attr("opacity", 1);
        })
        .on("mouseout", function() {
            hideTooltip();
            d3.select(this).attr("r", 4).attr("opacity", 0.6);
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
            .style("opacity", 0.6);
        g.append("text")
            .attr("x", 15)
            .attr("y", 10)
            .text(age)
            .style("fill", COLORS.text)
            .style("font-size", "10px");
    });
}

// 平台成瘾指数对比
function drawAddiction() {
    const container = d3.select("#addiction-chart");
    container.selectAll("*").remove();

    // 按平台计算平均成瘾指数
    const platforms = Array.from(new Set(socialData.map(d => d.platform)));
    const addictionData = platforms.map(platform => ({
        platform,
        addiction: d3.mean(socialData.filter(d => d.platform === platform), d => d.addiction)
    })).sort((a, b) => b.addiction - a.addiction);

    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const margin = {top: 20, right: 30, bottom: 40, left: 100};
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([0, 10])
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(addictionData.map(d => d.platform))
        .range([0, height])
        .padding(0.3);

    const colorScale = d3.scaleSequential()
        .domain([0, 10])
        .interpolator(d3.interpolateRgb(COLORS.success, COLORS.danger));

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .attr("class", "axis");

    svg.append("g")
        .call(d3.axisLeft(y))
        .attr("class", "axis");

    svg.selectAll(".bar")
        .data(addictionData)
        .join("rect")
        .attr("x", 0)
        .attr("y", d => y(d.platform))
        .attr("width", d => x(d.addiction))
        .attr("height", y.bandwidth())
        .attr("fill", d => colorScale(d.addiction))
        .attr("rx", 5)
        .on("mouseover", function(event, d) {
            showTooltip(event, `
                <div class="tooltip-title">${d.platform}</div>
                <div class="tooltip-row">
                    <span>成瘾指数:</span>
                    <span>${d.addiction.toFixed(1)}/10</span>
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
        .data(addictionData)
        .join("text")
        .attr("x", d => x(d.addiction) + 5)
        .attr("y", d => y(d.platform) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .style("fill", COLORS.text)
        .style("font-size", "11px")
        .style("font-weight", "600")
        .text(d => d.addiction.toFixed(1));
}

// ===== 第四页：全球对比 =====
function initGlobalPage() {
    drawGlobalRanking();
    drawRegionChart();
    drawGlobalBubble();
    
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
        .padding(0.2);

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
}

// 地区熬夜率对比
function drawRegionChart() {
    const container = d3.select("#region-chart");
    container.selectAll("*").remove();

    // 按地区统计
    const regions = Array.from(new Set(globalData.map(d => d.region)));
    const regionData = regions.map(region => {
        const regionCountries = globalData.filter(d => d.region === region);
        return {
            region,
            avgLateNight: d3.mean(regionCountries, d => d.lateNightRate),
            avgSleep: d3.mean(regionCountries, d => d.avgSleep)
        };
    }).sort((a, b) => b.avgLateNight - a.avgLateNight);

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

    const x = d3.scaleBand()
        .domain(regionData.map(d => d.region))
        .range([0, width])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, 100])
        .range([height, 0]);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .attr("class", "axis")
        .selectAll("text")
        .attr("transform", "rotate(-15)")
        .style("text-anchor", "end")
        .style("font-size", "10px");

    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d => d + "%"))
        .attr("class", "axis");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 45)
        .attr("fill", COLORS.text)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .text("地区");

    const colorScale = d3.scaleOrdinal()
        .domain(regions)
        .range([COLORS.danger, COLORS.tertiary, COLORS.secondary, COLORS.primary, COLORS.success]);

    svg.selectAll(".bar")
        .data(regionData)
        .join("rect")
        .attr("x", d => x(d.region))
        .attr("y", d => y(d.avgLateNight))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.avgLateNight))
        .attr("fill", d => colorScale(d.region))
        .attr("rx", 5)
        .on("mouseover", function(event, d) {
            showTooltip(event, `
                <div class="tooltip-title">${d.region}</div>
                <div class="tooltip-row">
                    <span>平均熬夜率:</span>
                    <span>${d.avgLateNight.toFixed(1)}%</span>
                </div>
                <div class="tooltip-row">
                    <span>平均睡眠:</span>
                    <span>${d.avgSleep.toFixed(1)}小时</span>
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
        .data(regionData)
        .join("text")
        .attr("x", d => x(d.region) + x.bandwidth() / 2)
        .attr("y", d => y(d.avgLateNight) - 5)
        .attr("text-anchor", "middle")
        .style("fill", COLORS.text)
        .style("font-size", "11px")
        .style("font-weight", "600")
        .text(d => d.avgLateNight.toFixed(0) + "%");
}

// 全球气泡图
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
        .range([5, 25]);

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
        .attr("opacity", 0.6)
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
                .attr("r", d => size(d.internetHours) + 3);
        })
        .on("mouseout", function(event, d) {
            hideTooltip();
            d3.select(this)
                .transition()
                .duration(200)
                .attr("opacity", 0.6)
                .attr("r", d => size(d.internetHours));
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
