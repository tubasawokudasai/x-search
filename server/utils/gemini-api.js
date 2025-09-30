/**
 * 服务器端Gemini API调用工具
 */
export async function callGeminiChat(prompt, apiKey) {
    // 验证参数
    if (!prompt || !apiKey) {
        throw new Error('缺少prompt或API密钥');
    }

    try {
        // 发起POST请求（对应curl命令）
        const response = await fetch(
            'https://my-openai-gemini-demo.vercel.app/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gemini-2.5-flash',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.5,
                    reasoning_effort: 'low',
                })
            }
        );

        // 处理HTTP错误状态
        if (!response.ok) {
            const errorDetails = await response.text().catch(() => '未知错误');
            throw new Error(`API请求失败: ${response.status} ${errorDetails}`);
        }

        // 解析JSON响应
        const data =await response.json();
        console.log('Gemini API响应数据:', JSON.stringify( data, null, 2))
        return data;
    } catch (error) {
        console.error('Gemini API调用失败:', error.message);
        throw error; // 向上传递错误，由调用方处理
    }
}
