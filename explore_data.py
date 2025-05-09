# -*- coding: utf-8 -*-
import pandas as pd

# Veri setinin tam yolunu belirt
data_path = 'market_data.csv'

# Veri setini oku
try:
    df = pd.read_csv(data_path)
except FileNotFoundError:
    print(f"Hata: {data_path} dosya yolu bulunamadı. Lütfen dosya yolunu kontrol edin.")
    exit()
except Exception as e:
    print(f"Veri okunurken bir hata oluştu: {e}")
    exit()

# İlk 5 satırı göster
print("Veri Setinin İlk 5 Satırı:")
print(df.head())
print("\n" + "-"*50 + "\n")

# Veri seti hakkında genel bilgi (sütun tipleri, boş olmayan değer sayısı)
print("Veri Seti Bilgileri:")
df.info()
print("\n" + "-"*50 + "\n")

# Sayısal sütunlar için istatistiksel özet
print("Sayısal Sütunlar İçin İstatistiksel Özet:")
print(df.describe())
print("\n" + "-"*50 + "\n")

# Kategorik sütunlar için istatistiksel özet
print("Kategorik Sütunlar İçin İstatistiksel Özet:")
print(df.describe(include='object'))
print("\n" + "-"*50 + "\n")

# Eksik değer kontrolü
print("Eksik Değer Sayıları:")
print(df.isnull().sum())
print("\n" + "-"*50 + "\n")

print("Veri keşfi tamamlandı.")

