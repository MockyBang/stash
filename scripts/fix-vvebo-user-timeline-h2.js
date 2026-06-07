(async () => {
    console.log("[VVebo] 脚本开始执行");
    try {
        let url = $request.url;
        let userAgent = $request.headers["User-Agent"] || $request.headers["user-agent"] || "";
        console.log(`[VVebo] 请求URL: ${url}`);
        console.log(`[VVebo] User-Agent: ${userAgent}`);

        if (!userAgent.includes("WeiboOverseas/4.1.4")) {
            console.log("[VVebo] UA不匹配，直接放行");
            $done({});
        } else {
            console.log("[VVebo] UA匹配VVebo，开始处理");
            const hasUid = (url) => url.includes("uid");
            const getUid = (url) => (hasUid(url) ? url.match(/uid=(\d+)/)[1] : undefined);
            const uidKey = "vvebo_uid";

            if (url.includes("remind/unread_count")) {
                console.log("[VVebo] 进入 remind/unread_count 分支");
                const uid = getUid(url);
                console.log(`[VVebo] 提取到 uid: ${uid}`);
                if (uid) {
                    $persistentStore.write(uid, uidKey);
                    console.log(`[VVebo] 已存储 uid 到持久化存储 (key: ${uidKey})`);
                } else {
                    console.log("[VVebo] 警告：未提取到 uid");
                }
                $done({});
                console.log("[VVebo] remind/unread_count 处理完成");
            } else if (url.includes("statuses/user_timeline")) {
                console.log("[VVebo] 进入 statuses/user_timeline 分支");
                const uid = getUid(url) || $persistentStore.read(uidKey);
                console.log(`[VVebo] 当前使用的 uid: ${uid}`);
                if (!uid) {
                    console.log("[VVebo] 无法获取 uid，放弃处理，放行原请求");
                    $done({});
                } else {
                    // 构造新URL
                    let newUrl = url.replace("statuses/user_timeline", "profile/statuses/tab").replace("max_id", "since_id");
                    newUrl = newUrl + `&containerid=230413${uid}_-_WEIBO_SECOND_PROFILE_WEIBO`;
                    console.log(`[VVebo] 主动请求新接口 URL: ${newUrl}`);

                    // 发起 GET 请求
                    console.log("[VVebo] 正在请求新接口...");
                    const response = await new Promise((resolve, reject) => {
                        $httpClient.get(newUrl, (error, resp, body) => {
                            if (error) {
                                console.log(`[VVebo] 请求失败: ${error}`);
                                reject(error);
                            } else {
                                console.log(`[VVebo] 请求成功，状态码: ${resp.status}`);
                                resolve({ status: resp.status, headers: resp.headers, body });
                            }
                        });
                    });

                    if (response.status === 200) {
                        console.log("[VVebo] 开始解析响应数据");
                        const data = JSON.parse(response.body);
                        const originalCardsCount = data.cards ? data.cards.length : 0;
                        console.log(`[VVebo] 原始卡片数: ${originalCardsCount}`);

                        const statuses = data.cards
                            .map((card) => (card.card_group ? card.card_group : card))
                            .flat()
                            .filter((card) => card.card_type === 9)
                            .map((card) => card.mblog)
                            .map((status) => (status.isTop ? { ...status, label: "置顶" } : status));
                        const sinceId = data.cardlistInfo ? data.cardlistInfo.since_id : "";
                        console.log(`[VVebo] 过滤后博文数: ${statuses.length}, since_id: ${sinceId}`);

                        const body = JSON.stringify({ statuses, since_id: sinceId, total_number: 100 });
                        console.log("[VVebo] 返回修改后的响应体");
                        $done({ response: { body } });
                    } else {
                        console.log(`[VVebo] 新接口请求失败，状态码: ${response.status}，放行原请求`);
                        $done({});
                    }
                }
            } else {
                console.log("[VVebo] 未匹配任何分支，直接放行");
                $done({});
            }
        }
    } catch (e) {
        console.log(`[VVebo] 脚本异常: ${e.message}`);
        if (e.stack) console.log(`[VVebo] 堆栈: ${e.stack}`);
        $done({});
    }
    console.log("[VVebo] 脚本执行结束");
})();
