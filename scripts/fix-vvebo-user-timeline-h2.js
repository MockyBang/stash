(async () => {
    try {
        let url = $request.url;
        let userAgent = $request.headers["User-Agent"] || $request.headers["user-agent"] || "";

        if (!userAgent.includes("WeiboOverseas/4.1.4")) {
            $done({});
        } else {
            const hasUid = (url) => url.includes("uid");
            const getUid = (url) => (hasUid(url) ? url.match(/uid=(\d+)/)[1] : undefined);
            const uidKey = "vvebo_uid";

            if (url.includes("remind/unread_count")) {
                const uid = getUid(url);
                $persistentStore.write(uid, uidKey);
                $done({});
            } else if (url.includes("statuses/user_timeline")) {
                const uid = getUid(url) || $persistentStore.read(uidKey);
                // 改为主动请求新接口，不再使用 $done({ url })
                let newUrl = url.replace("statuses/user_timeline", "profile/statuses/tab").replace("max_id", "since_id");
                newUrl = newUrl + `&containerid=230413${uid}_-_WEIBO_SECOND_PROFILE_WEIBO`;
                console.log("[VVebo] 主动请求新接口: " + newUrl);
                const response = await new Promise((resolve, reject) => {
                    $httpClient.get(newUrl, (error, resp, body) => {
                        if (error) reject(error);
                        else resolve({ status: resp.status, headers: resp.headers, body });
                    });
                });
                if (response.status === 200) {
                    const data = JSON.parse(response.body);
                    const statuses = data.cards
                        .map((card) => (card.card_group ? card.card_group : card))
                        .flat()
                        .filter((card) => card.card_type === 9)
                        .map((card) => card.mblog)
                        .map((status) => (status.isTop ? { ...status, label: "置顶" } : status));
                    const sinceId = data.cardlistInfo ? data.cardlistInfo.since_id : "";
                    const body = JSON.stringify({ statuses, since_id: sinceId, total_number: 100 });
                    $done({ response: { body } });
                } else {
                    console.log("[VVebo] 新接口请求失败，状态码: " + response.status);
                    $done({});
                }
            } else if (url.includes("profile/statuses/tab")) {
                const data = JSON.parse($response.body);
                const statuses = data.cards
                    .map((card) => (card.card_group ? card.card_group : card))
                    .flat()
                    .filter((card) => card.card_type === 9)
                    .map((card) => card.mblog)
                    .map((status) => (status.isTop ? { ...status, label: "置顶" } : status));
                const sinceId = data.cardlistInfo.since_id;
                const body = JSON.stringify({ statuses, since_id: sinceId, total_number: 100 });
                $done({ body });
            } else {
                $done({});
            }
        }
    } catch (e) {
        console.log("[VVebo] 脚本异常: " + e.message);
        $done({});
    }
})();
