// ===== 全局配置 =====
const COLORS = {
    primary: "#06b6d4",   // Cyan
    secondary: "#8b5cf6", // Violet
    danger: "#f43f5e",    // Red
    warning: "#f59e0b",   // Orange
    success: "#10b981",   // Green
    bg: "#1e293b",
    text: "#f1f5f9"
};

let rawData = [];
let filteredData = [];
const tooltip = d3.select("#tooltip");

// ===== 1. 数据加载与预处理 =====
d3.csv("Sleep_health_and_lifestyle_dataset.csv").then(data => {
    // 隐藏 Loading
    d3.select("#loader").style("display", "none");

    // 格式化数据 (映射 CSV 列名到 JS 变量)
    rawData = data.map((d, i) => ({
        id: d['Person ID'],
        gender: d.Gender,
        age: +d.Age,
        occupation: d.Occupation,
        sleepDuration: +d['Sleep Duration'],
        sleepQuality: +d['Quality of Sleep'],
        activityLevel: +d['Physical Activity Level'], // min/day
        stressLevel: +d['Stress Level'], // 1-10
        bmi: d['BMI Category'],
        bp: d['Blood Pressure'],
        heartRate: +d['Heart Rate'],
        steps: +d['Daily Steps'],
        disorder: d['Sleep Disorder'] === "None" ? "No Disorder" : d['Sleep Disorder']
    }));

    // 初始化下拉菜单
    initControls();
    
    // 首次渲染
    updateDashboard("all");

}).catch(err => {
    alert("Data loading failed! Please check if the CSV file is in the 'src' folder and named correctly.");
    console.error(err);
});

// ===== 2. 初始化控件 =====
function initControls() {
    const occupations = Array.from(new Set(rawData.map(d => d.occupation))).sort();
    const select = d3.select("#occupationSelect");
    
    occupations.forEach(occ => {
        select.append("option").text(occ).attr("value", occ);
    });

    select.on("change", function() {
        updateDashboard(this.value);
    });
}

// ===== 3. 主更新逻辑 =====
function updateDashboard(occupation) {
    // 过滤数据
    filteredData = occupation === "all" 
        ? rawData 
        : rawData.filter(d => d.occupation === occupation);

    updateKPIs(filteredData);
    
    // 清空画布
    d3.selectAll("#scatter-chart, #radar-chart, #bar-chart, #donut-chart").html("");

    // 绘制所有图表
    drawScatter(filteredData);
    drawRadar(filteredData, null); // 初始只显示平均值
    drawBarChart(filteredData);
    drawDonut(filteredData);
}

// ===== KPI 更新 =====
function updateKPIs(data) {
    const format = d3.format(".1f");
    d3.select("#kpi-count").text(data.length);
    d3.select("#kpi-sleep").text(format(d3.mean(data, d => d.sleepDuration)));
    d3.select("#kpi-stress").text(format(d3.mean(data, d => d.stressLevel)));
    d3.select("#kpi-steps").text(d3.format(",")(d3.mean(data, d => d.steps).toFixed(0)));
}

// ===== 图表 A: 气泡散点图 (运动 vs 睡眠) =====
function drawScatter(data) {
    const container = document.getElementById("scatter-chart");
    const margin = {top: 20, right: 20, bottom: 40, left: 50};
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    const svg = d3.select("#scatter-chart").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // X轴: 运动量
    const x = d3.scaleLinear()
        .domain([20, 100])
        .range([0, width]);

    // Y轴: 睡眠质量 (1-10)
    const y = d3.scaleLinear()
        .domain([3, 10])
        .range([height, 0]);

    // 颜色: 基于 BMI
    const color = d3.scaleOrdinal()
        .domain(["Normal", "Normal Weight", "Overweight", "Obese"])
        .range([COLORS.success, COLORS.success, COLORS.warning, COLORS.danger]);

    // 绘制轴
    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x)).attr("class", "axis");
    svg.append("g").call(d3.axisLeft(y)).attr("class", "axis");

    // 轴标签
    svg.append("text").attr("x", width/2).attr("y", height+35).attr("fill", COLORS.text).style("text-anchor", "middle").text("Physical Activity (min/day)");
    svg.append("text").attr("transform", "rotate(-90)").attr("y", -35).attr("x", -height/2).attr("fill", COLORS.text).style("text-anchor", "middle").text("Sleep Quality (1-10)");

    // 绘制点
    svg.selectAll("circle")
        .data(data)
        .join("circle")
        .attr("cx", d => x(d.activityLevel))
        .attr("cy", d => y(d.sleepQuality))
        .attr("r", d => d.sleepDuration * 1.5) // 半径代表睡眠时长
        .style("fill", d => color(d.bmi))
        .style("opacity", 0.6)
        .style("stroke", "#fff")
        .style("stroke-width", 0.5)
        .on("mouseover", (event, d) => {
            // Tooltip
            showTooltip(event, `
                <strong>${d.occupation}</strong> (${d.gender}, ${d.age}y)<br>
                BMI: ${d.bmi}<br>
                Sleep: ${d.sleepDuration}h (Qual: ${d.sleepQuality})<br>
                Steps: ${d.steps}
            `);
            d3.select(event.currentTarget).style("opacity", 1).style("stroke-width", 2).attr("r", d.sleepDuration * 2);
            
            // 联动：更新雷达图以显示此人的具体数据
            drawRadar(filteredData, d);
        })
        .on("mouseout", (event) => {
            hideTooltip();
            d3.select(event.currentTarget).style("opacity", 0.6).style("stroke-width", 0.5).attr("r", d => d.sleepDuration * 1.5);
            // 恢复雷达图为平均值
            drawRadar(filteredData, null);
        });
}

// ===== 图表 B: 雷达图 (复杂对比) =====
function drawRadar(allData, specificUser) {
    // 如果已有 SVG，先移除（为了重绘）
    d3.select("#radar-chart").select("svg").remove();

    const container = document.getElementById("radar-chart");
    const width = container.clientWidth;
    const height = container.clientHeight;
    const radius = Math.min(width, height) / 2 - 30;

    const svg = d3.select("#radar-chart").append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width/2},${height/2})`);

    // 定义维度
    const features = ["Sleep Duration", "Quality", "Stress Level", "Activity Lvl", "Heart Rate"];
    
    // 归一化函数 (将不同范围的数据映射到 0-10)
    const normalize = (d) => ({
        "Sleep Duration": (d.sleepDuration / 10) * 10,
        "Quality": (d.sleepQuality / 10) * 10,
        "Stress Level": (d.stressLevel / 10) * 10,
        "Activity Lvl": (d.activityLevel / 100) * 10,
        "Heart Rate": ((d.heartRate - 60) / (90-60)) * 10 // 假设心率范围 60-90
    });

    // 计算平均值数据
    const avgData = {};
    features.forEach(f => {
        const key = f === "Sleep Duration" ? "sleepDuration" : 
                    f === "Quality" ? "sleepQuality" :
                    f === "Stress Level" ? "stressLevel" :
                    f === "Activity Lvl" ? "activityLevel" : "heartRate";
        avgData[f] = d3.mean(allData, d => d[key]);
    });
    
    const ticks = [2, 4, 6, 8, 10];
    const angleSlice = Math.PI * 2 / features.length;
    const rScale = d3.scaleLinear().range([0, radius]).domain([0, 10]);

    // 绘制网格圆圈
    ticks.forEach(t => {
        svg.append("circle")
            .attr("r", rScale(t))
            .style("fill", "none")
            .style("stroke", "#334155")
            .style("stroke-dasharray", "3,3");
    });

    // 绘制轴线
    features.forEach((f, i) => {
        const angle = angleSlice * i - Math.PI/2;
        const x = rScale(10) * Math.cos(angle);
        const y = rScale(10) * Math.sin(angle);
        
        svg.append("line")
            .attr("x1", 0).attr("y1", 0)
            .attr("x2", x).attr("y2", y)
            .style("stroke", "#334155");

        svg.append("text")
            .attr("x", rScale(11.5) * Math.cos(angle))
            .attr("y", rScale(11.5) * Math.sin(angle))
            .text(f)
            .style("text-anchor", "middle")
            .style("font-size", "10px")
            .style("fill", COLORS.text);
    });

    // 绘制雷达区域函数
    const line = d3.lineRadial()
        .angle((d, i) => i * angleSlice)
        .radius(d => rScale(d))
        .curve(d3.curveLinearClosed);

    // 1. 绘制平均值 (蓝色区域)
    const normalizedAvg = features.map(f => normalize({
        sleepDuration: avgData["Sleep Duration"],
        sleepQuality: avgData["Quality"],
        stressLevel: avgData["Stress Level"],
        activityLevel: avgData["Activity Lvl"],
        heartRate: avgData["Heart Rate"]
    })[f]);

    svg.append("path")
        .datum(normalizedAvg)
        .attr("d", line)
        .style("fill", COLORS.primary)
        .style("fill-opacity", 0.3)
        .style("stroke", COLORS.primary)
        .style("stroke-width", 2);

    // 2. 如果有具体用户，绘制用户数据 (紫色线条)
    if (specificUser) {
        const normalizedUser = features.map(f => normalize(specificUser)[f]);
        
        svg.append("path")
            .datum(normalizedUser)
            .attr("d", line)
            .style("fill", "none")
            .style("stroke", "#fff")
            .style("stroke-width", 3)
            .style("filter", "drop-shadow(0 0 5px white)");
            
        svg.append("text")
            .attr("y", radius + 20)
            .text(`Comparing: User ${specificUser.id}`)
            .attr("text-anchor", "middle")
            .style("fill", "#fff");
    } else {
         svg.append("text")
            .attr("y", radius + 20)
            .text("Displaying Group Average")
            .attr("text-anchor", "middle")
            .style("fill", COLORS.text)
            .style("font-size", "10px");
    }
}

// ===== 图表 C: 堆叠条形图 (BMI vs Disorder) =====
function drawBarChart(data) {
    const container = document.getElementById("bar-chart");
    const margin = {top: 20, right: 20, bottom: 40, left: 40};
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    const svg = d3.select("#bar-chart").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 数据聚合: 按 BMI 分组，统计每种 Disorder 的数量
    const groups = ["Normal", "Overweight", "Obese"]; // 简化 BMI 类
    const subgroups = ["No Disorder", "Sleep Apnea", "Insomnia"];

    // 处理 BMI 类别命名不一致问题
    const cleanData = data.map(d => ({
        ...d,
        bmi: d.bmi === "Normal Weight" ? "Normal" : d.bmi
    }));

    // Rollup
    let preparedData = [];
    groups.forEach(g => {
        let obj = { group: g };
        subgroups.forEach(sub => {
            obj[sub] = cleanData.filter(d => d.bmi === g && d.disorder === sub).length;
        });
        preparedData.push(obj);
    });

    // 堆叠
    const stackedData = d3.stack().keys(subgroups)(preparedData);

    const x = d3.scaleBand().domain(groups).range([0, width]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(preparedData, d => d["No Disorder"] + d["Sleep Apnea"] + d["Insomnia"])]).range([height, 0]);
    const color = d3.scaleOrdinal().domain(subgroups).range([COLORS.success, COLORS.warning, COLORS.danger]);

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x)).attr("class", "axis").style("color", COLORS.text);
    svg.append("g").call(d3.axisLeft(y)).attr("class", "axis").style("color", COLORS.text);

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
            showTooltip(event, `${subgroupName}: ${d.data[subgroupName]} people`);
            d3.select(event.currentTarget).style("opacity", 0.8);
        })
        .on("mouseout", (event) => {
            hideTooltip();
            d3.select(event.currentTarget).style("opacity", 1);
        });
        
    // 图例
    const legend = svg.append("g").attr("transform", `translate(${width-100}, 0)`);
    subgroups.forEach((sub, i) => {
        legend.append("rect").attr("x", 0).attr("y", i*20).attr("width", 10).attr("height", 10).style("fill", color(sub));
        legend.append("text").attr("x", 15).attr("y", i*20+9).text(sub).style("fill", COLORS.text).style("font-size", "10px");
    });
}

// ===== 图表 D: 环形图 (压力分布) =====
function drawDonut(data) {
    const container = document.getElementById("donut-chart");
    const width = container.clientWidth;
    const height = container.clientHeight;
    const radius = Math.min(width, height) / 2 - 20;

    const svg = d3.select("#donut-chart").append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width/2},${height/2})`);

    // 分组: 低(1-4), 中(5-7), 高(8-10)
    const counts = { "Low (1-4)": 0, "Medium (5-7)": 0, "High (8-10)": 0 };
    data.forEach(d => {
        if(d.stressLevel <= 4) counts["Low (1-4)"]++;
        else if(d.stressLevel <= 7) counts["Medium (5-7)"]++;
        else counts["High (8-10)"]++;
    });

    const pieData = Object.entries(counts).map(([k, v]) => ({ key: k, value: v })).filter(d => d.value > 0);

    const color = d3.scaleOrdinal()
        .domain(["Low (1-4)", "Medium (5-7)", "High (8-10)"])
        .range([COLORS.success, COLORS.warning, COLORS.danger]);

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.6).outerRadius(radius);

    svg.selectAll("path")
        .data(pie(pieData))
        .join("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data.key))
        .attr("stroke", COLORS.bg)
        .style("stroke-width", "2px")
        .on("mouseover", (event, d) => {
            showTooltip(event, `Stress ${d.data.key}<br>${d.data.value} people<br>${(d.data.value/data.length*100).toFixed(1)}%`);
            d3.select(event.currentTarget).style("opacity", 0.8).attr("d", d3.arc().innerRadius(radius*0.6).outerRadius(radius+5));
        })
        .on("mouseout", (event) => {
            hideTooltip();
            d3.select(event.currentTarget).style("opacity", 1).attr("d", arc);
        });

    // 中心文字
    svg.append("text")
        .text("Stress")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.2em")
        .style("fill", COLORS.text)
        .style("font-size", "14px");
        
    svg.append("text")
        .text("Levels")
        .attr("text-anchor", "middle")
        .attr("dy", "1em")
        .style("fill", COLORS.text)
        .style("font-size", "14px");
}

// ===== 工具 =====
function showTooltip(event, html) {
    tooltip.style("opacity", 1)
        .html(html)
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 15) + "px");
}

function hideTooltip() {
    tooltip.style("opacity", 0);
}

// 窗口大小调整
window.addEventListener('resize', () => {
    updateDashboard(d3.select("#occupationSelect").property("value"));
});