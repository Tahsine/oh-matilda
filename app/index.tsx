import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const provider = createOpenAICompatible({
  name: "llama.cpp",
  baseURL: "http://192.168.100.166:8001/v1", // ← ton IP locale + port llama.cpp
});

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Index() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const { text } = await generateText({
        model: provider("unsloth/gemma-4-26B-A4B-it-GGUF"), // ← nom du modèle chargé dans llama.cpp
        messages: history,
      });

      setMessages([...history, { role: "assistant", content: text }]);
    } catch (e) {
      setMessages([
        ...history,
        { role: "assistant", content: "Erreur : " + String(e) },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ gap: 12 }}>
        {messages.map((m, i) => (
          <View
            key={i}
            className={`max-w-[80%] p-3 rounded-2xl ${
              m.role === "user" ? "bg-black self-end" : "bg-gray-100 self-start"
            }`}
          >
            <Text className={m.role === "user" ? "text-white" : "text-black"}>
              {m.content}
            </Text>
          </View>
        ))}
        {loading && (
          <View className="bg-gray-100 self-start p-3 rounded-2xl">
            <ActivityIndicator size="small" color="#000" />
          </View>
        )}
      </ScrollView>

      <View className="flex-row items-center gap-2 p-4 border-t border-gray-200">
        <TextInput
          className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-base"
          placeholder="Message..."
          value={input}
          onChangeText={setInput}
          multiline
        />
        <TouchableOpacity
          onPress={send}
          disabled={loading}
          className="bg-black rounded-full w-10 h-10 items-center justify-center"
        >
          <Text className="text-white text-lg">↑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}