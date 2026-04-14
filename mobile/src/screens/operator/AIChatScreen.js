import React, { useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenContainer from '../../components/ScreenContainer';
import PrimaryButton from '../../components/PrimaryButton';
import { sendChatMessageApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const normalizeHistoryPayload = (messages) =>
  messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.text }));

export default function AIChatScreen({ route }) {
  const { session } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatId, setChatId] = useState(null);
  const predictionId = Number(route.params?.predictionId || 0) || null;

  const canSend = useMemo(() => Boolean(input.trim()) && !sending, [input, sending]);

  const send = async () => {
    const message = input.trim();
    if (!message) return;

    const nextMessages = [...messages, { role: 'user', text: message, localId: `u-${Date.now()}` }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    try {
      const response = await sendChatMessageApi({
        token: session?.token,
        userId: session?.userId,
        message,
        history: normalizeHistoryPayload(nextMessages),
        chatId,
        predictionId
      });

      if (response?.chat_id) {
        setChatId(response.chat_id);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: String(response?.reply || 'No response'),
          localId: `a-${Date.now()}`
        }
      ]);
    } catch (error) {
      Alert.alert('Chat failed', error?.error || 'Unable to send message.');
      setMessages((prev) => prev.filter((m) => m.localId !== nextMessages[nextMessages.length - 1].localId));
      setInput(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenContainer scroll={false}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>AI Chat</Text>
        <Text style={styles.subtitle}>
          Ask about disease symptoms, treatments, and prevention steps.
        </Text>
        {predictionId ? (
          <Text style={styles.contextTag}>Context: prediction #{predictionId}</Text>
        ) : null}

        <FlatList
          data={messages}
          keyExtractor={(item) => String(item.localId)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Start by asking a treatment question.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              <Text style={item.role === 'user' ? styles.userText : styles.aiText}>{item.text}</Text>
            </View>
          )}
        />

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask the AI assistant..."
            style={styles.input}
            multiline
          />
          <PrimaryButton title="Send" onPress={send} loading={sending} disabled={!canSend} />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a'
  },
  subtitle: {
    color: '#475569',
    marginBottom: 8
  },
  contextTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    color: '#166534',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
    overflow: 'hidden'
  },
  list: {
    flexGrow: 1,
    paddingVertical: 10,
    gap: 8
  },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 30
  },
  bubble: {
    padding: 12,
    borderRadius: 12,
    maxWidth: '88%'
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#16a34a'
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  userText: {
    color: '#ffffff'
  },
  aiText: {
    color: '#0f172a'
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    gap: 8
  },
  input: {
    minHeight: 80,
    maxHeight: 130,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top'
  }
});
