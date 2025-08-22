import {
  BotMessage,
  BotMessageType,
  CTAActionType,
  ListingsBotMessage,
  TextBotMessage,
} from './dto/bot-message.dto';

interface Listing {
  _id: string;
  title: string;
  price_per_night: number;
  description: string;
  images?: string[];
  status: string;
  propertyId?: {
    _id: string;
    name: string;
    location?: {
      address?: string;
      city?: string;
      district?: string;
    };
    description?: string;
  };
  max_guests?: number;
}

export class ResponseFormatter {
  /**
   * Format a plain text response
   */
  static formatTextResponse(text: string): TextBotMessage {
    // Remove common emoji patterns to clean up the text
    const cleanText = this.removeIcons(text);

    // Apply additional formatting improvements
    const formattedText = this.improveTextFormatting(cleanText);

    return {
      type: BotMessageType.TEXT,
      text: formattedText,
    };
  }

  /**
   * Format voucher information response
   */
  static formatVoucherResponse(vouchers: any[]): TextBotMessage {
    if (!vouchers || vouchers.length === 0) {
      return this.formatTextResponse(
        `Hiện tại chưa có voucher nào khả dụng.

Hỗ trợ:
Liên hệ hotline để được tư vấn về các chương trình khuyến mãi hiện tại.`,
      );
    }

    let formattedText = `Thông tin voucher hiện tại:

Vinaside đang có ${vouchers.length} voucher khả dụng:

`;

    vouchers.forEach((voucher, index) => {
      const discountText = voucher.discount_percentage
        ? `${voucher.discount_percentage}%`
        : voucher.discount_amount
          ? `${voucher.discount_amount.toLocaleString('vi-VN')} VNĐ`
          : 'Giảm giá';

      const minOrderText = voucher.min_order_amount
        ? `Đơn hàng từ ${voucher.min_order_amount.toLocaleString('vi-VN')} VNĐ`
        : 'Không giới hạn giá trị đơn hàng';

      const expiryDate = voucher.expiry_date
        ? new Date(voucher.expiry_date).toLocaleDateString('vi-VN')
        : 'Không giới hạn thời gian';

      const usageLimit = voucher.usage_limit
        ? `${voucher.usage_limit} lần`
        : 'Không giới hạn';

      formattedText += `${index + 1}. ${voucher.code} - ${discountText}
   Điều kiện: ${minOrderText}
   Hiệu lực đến: ${expiryDate}
   Số lần sử dụng: ${usageLimit}
   Mô tả: ${voucher.description || 'Không có mô tả'}

`;
    });

    formattedText += `Cách sử dụng:
1. Chọn phòng phù hợp
2. Nhập mã voucher khi thanh toán
3. Hệ thống sẽ tự động áp dụng giảm giá

Bạn muốn tìm phòng để sử dụng voucher không?`;

    return this.formatTextResponse(formattedText);
  }

  /**
   * Format service information response
   */
  static formatServiceResponse(services: any[]): TextBotMessage {
    if (!services || services.length === 0) {
      return this.formatTextResponse(
        `Dịch vụ hiện tại:
Vinaside cung cấp các dịch vụ cơ bản cho tất cả homestay.

Dịch vụ chuẩn:
- Dọn phòng hàng ngày
- Hỗ trợ đặt xe
- Tư vấn du lịch
- Dịch vụ giặt ủi
- Bữa sáng (tùy chọn)

Hỗ trợ:
Liên hệ hotline để được tư vấn chi tiết về các dịch vụ đặc biệt.`,
      );
    }

    let formattedText = `Dịch vụ Vinaside cung cấp:

Các dịch vụ chính:

`;

    services.forEach((service, index) => {
      formattedText += `${index + 1}. ${service.name}
   Mô tả: ${service.description || 'Không có mô tả'}
   Giá: ${service.price ? `${service.price.toLocaleString('vi-VN')} VNĐ` : 'Liên hệ'}
   Trạng thái: ${service.is_available ? 'Có sẵn' : 'Tạm thời không có'}

`;
    });

    formattedText += `Dịch vụ bổ sung:
- Dọn phòng hàng ngày
- Hỗ trợ đặt xe
- Tư vấn du lịch
- Dịch vụ giặt ủi
- Bữa sáng (tùy chọn)

Bạn cần tư vấn thêm về dịch vụ nào không?`;

    return this.formatTextResponse(formattedText);
  }

  /**
   * Format a listing response
   */
  static formatListingsResponse(
    rooms: Listing[],
    checkIn?: string,
    checkOut?: string,
    guests?: number,
    city?: string,
    holdId?: string,
  ): ListingsBotMessage {
    const nights =
      checkIn && checkOut
        ? Math.ceil(
            (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : undefined;

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN');
    };

    const dateRange =
      checkIn && checkOut
        ? `${formatDate(checkIn)} - ${formatDate(checkOut)}`
        : undefined;

    return {
      type: BotMessageType.LISTINGS,
      header: `Danh sách phòng trống${city ? ` tại ${city}` : ''}`,
      meta: {
        dateRange,
        guests,
        city,
        total: rooms.length,
      },
      items: rooms.map((room) => ({
        id: room._id,
        title: room.title,
        pricePerNight: room.price_per_night,
        totalPrice: nights ? room.price_per_night * nights : undefined,
        address: room.propertyId?.location?.address || room.propertyId?.name,
        imageUrl: room.images?.[0],
        detailUrl: `/room-detail/${room._id}`,
        tags: this.generateTags(room),
      })),
      cta:
        holdId === 'book_now'
          ? {
              label: 'Đặt ngay',
              action: CTAActionType.HOLD,
              payload: {
                holdId: 'book_now',
                roomId: rooms[0]?._id,
              },
            }
          : holdId
            ? {
                label: 'Đặt ngay',
                action: CTAActionType.HOLD,
                payload: {
                  holdId,
                  roomId: rooms[0]?._id,
                },
              }
            : {
                label: 'Xem chi tiết',
                action: CTAActionType.DETAIL,
              },
    };
  }

  /**
   * Parse plain text response to extract listing data
   * Try to identify listing sections in the text and return a structured message
   */
  static parseTextResponseForListings(text: string): BotMessage {
    // Check if this looks like a listing response
    const hasMultipleListings =
      (text.match(/\*\*.*Phòng.*\*\*/g) || []).length >= 1;
    const hasPricePatterns = text.match(/VNĐ\/đêm|Giá:|💰|VND\/đêm|VNĐ\/đêm/gi);
    const hasRoomDetails = text.match(
      /Số giường:|Số phòng tắm:|Số khách tối đa:/gi,
    );

    if (!hasMultipleListings || !hasPricePatterns) {
      return this.formatTextResponse(text);
    }

    // Try to extract listing data using regex patterns for markdown format
    const listingMatches = text.match(
      /\*\*([^*]+)\*\*[\s\S]*?(?=\*\*[^*]+\*\*|$)/g,
    );

    if (!listingMatches || listingMatches.length < 1) {
      return this.formatTextResponse(text);
    }

    const items = listingMatches
      .map((listing) => {
        // Extract title from **Title**
        const titleMatch = listing.match(/\*\*([^*]+)\*\*/);
        const title = titleMatch ? titleMatch[1].trim() : '';

        // Extract price
        const priceMatch = listing.match(/(\d[\d.,]*)\s*VNĐ\/đêm/i);
        const pricePerNight = priceMatch
          ? parseInt(priceMatch[1].replace(/[.,]/g, ''))
          : 0;

        // Extract address
        const addressMatch = listing.match(/Địa chỉ:\s*(.*?)(?:\n|$)/);
        const address = addressMatch ? addressMatch[1].trim() : '';

        // Extract beds
        const bedsMatch = listing.match(/Số giường:\s*(\d+)/);
        const beds = bedsMatch ? parseInt(bedsMatch[1]) : undefined;

        // Extract bathrooms
        const bathroomsMatch = listing.match(/Số phòng tắm:\s*(\d+)/);
        const bathrooms = bathroomsMatch
          ? parseInt(bathroomsMatch[1])
          : undefined;

        // Extract max guests
        const guestsMatch = listing.match(/Số khách tối đa:\s*(\d+)/);
        const maxGuests = guestsMatch ? parseInt(guestsMatch[1]) : undefined;

        // Generate a temporary ID
        const id = `temp-${Math.random().toString(36).substring(2, 11)}`;

        return {
          id,
          title,
          pricePerNight,
          address,
          tags: [
            ...(beds ? [`${beds} giường`] : []),
            ...(bathrooms ? [`${bathrooms} phòng tắm`] : []),
            ...(maxGuests ? [`${maxGuests} khách`] : []),
          ],
        };
      })
      .filter((item) => {
        // Filter out items that are not actual rooms
        const invalidTitles = [
          'Thông tin phòng phù hợp với yêu cầu của bạn:',
          'Thông tin phòng:',
          'Danh sách phòng:',
          'Các phòng:',
          'Phòng phù hợp:',
        ];

        // Remove items with invalid titles
        return (
          !invalidTitles.some((invalidTitle) =>
            item.title.toLowerCase().includes(invalidTitle.toLowerCase()),
          ) && item.title.length > 0
        );
      });

    // Extract header from the beginning of the message
    const headerMatch = text.match(/^(.*?)(?:\n|$)/);
    const header = headerMatch ? headerMatch[1].trim() : 'Danh sách phòng';

    // Try to extract meta information
    const dateRangeMatch = text.match(
      /(\d{1,2}\/\d{1,2}\/\d{4})(?:\s*[-–]\s*)(\d{1,2}\/\d{1,2}\/\d{4})/,
    );
    const guestsMatch = text.match(/(\d+)\s*(?:khách|người|guest|guests)/i);
    // Capture multi-word city names like "Hà Nội" instead of just "Hà"
    const cityMatch = text.match(
      /ở\s+([A-Za-zÀ-ỹ\s]{2,}?)(?=(?:\s+(?:có|sau|đang|hiện)|[\.,:\n]|$))/i,
    );

    const meta = {
      dateRange: dateRangeMatch
        ? `${dateRangeMatch[1]} - ${dateRangeMatch[2]}`
        : undefined,
      guests: guestsMatch ? parseInt(guestsMatch[1]) : undefined,
      city: cityMatch ? cityMatch[1].trim() : undefined,
      total: items.length,
    };

    // Check for CTA
    const hasHoldCTA =
      text.toLowerCase().includes('đặt phòng') ||
      text.toLowerCase().includes('ưng ý phòng nào');

    const base: ListingsBotMessage = {
      type: BotMessageType.LISTINGS,
      header: this.removeIcons(header),
      meta,
      items,
    } as ListingsBotMessage;

    // Show CTA when there is a concrete date range or when it's a room details request
    if (meta.dateRange || items.length === 1) {
      base.cta = hasHoldCTA
        ? { label: 'Đặt ngay', action: CTAActionType.HOLD }
        : { label: 'Xem chi tiết', action: CTAActionType.DETAIL };
    }

    return base;
  }

  /**
   * Enrich parsed listing items with internal data: fix city, add detailUrl, price, address, tags
   * Also remove guests from meta when not relevant
   */
  static enrichWithInternalData(
    message: ListingsBotMessage,
    internalData: {
      listings: Array<{
        _id: string;
        title: string;
        price_per_night: number;
        images?: string[];
        propertyId?: { location?: { address?: string; city?: string } };
        max_guests?: number;
      }>;
    } | null,
  ): ListingsBotMessage {
    if (!internalData || !internalData.listings || !message.items?.length) {
      // Still ensure no guests in meta for generic count queries
      if (message.meta) delete message.meta.guests;
      return message;
    }

    const normalized = (s: string) =>
      (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const citiesCollected: string[] = [];

    const updatedItems = message.items.map((it) => {
      const match = internalData.listings.find(
        (l) =>
          normalized(l.title).includes(normalized(it.title)) ||
          normalized(it.title).includes(normalized(l.title)),
      );
      if (!match) return it;
      const matchedCity = match.propertyId?.location?.city;
      if (matchedCity) citiesCollected.push(matchedCity);
      return {
        ...it,
        id: match._id,
        pricePerNight: match.price_per_night || it.pricePerNight,
        address: match.propertyId?.location?.address || it.address,
        imageUrl: match.images?.[0] || it.imageUrl,
        detailUrl: `/room-detail/${match._id}`,
        tags: this.generateTags({
          _id: match._id,
          title: match.title,
          price_per_night: match.price_per_night,
          description: '',
          status: 'active',
          propertyId: match.propertyId as any,
          max_guests: match.max_guests,
        } as any),
      };
    });

    // Prefer matched property city if present; fallback to extracting from address tokens
    let inferredCity: string | undefined = citiesCollected.find(Boolean);
    if (!inferredCity) {
      const citiesFromAddress = updatedItems
        .map((it) => it.address)
        .filter((a): a is string => !!a)
        .map((a) => {
          const tokens = a.split(',').map((p) => p.trim());
          // Heuristic: second-to-last token often is city (e.g., "..., Quận Hoàn Kiếm, Hà Nội, Việt Nam")
          if (tokens.length >= 2) {
            return tokens[tokens.length - 2];
          }
          return tokens[tokens.length - 1];
        })
        .filter((c): c is string => !!c);
      inferredCity = citiesFromAddress.length
        ? citiesFromAddress[0]
        : undefined;
    }

    const enriched: ListingsBotMessage = {
      ...message,
      meta: {
        ...(message.meta || {}),
        city: inferredCity || message.meta?.city,
      },
      items: updatedItems,
    };

    // Remove guests from meta as requested
    if (enriched.meta && 'guests' in enriched.meta) {
      delete enriched.meta.guests;
    }

    return enriched;
  }

  /**
   * Generate tags for a room based on its properties
   */
  private static generateTags(room: Listing): string[] {
    const tags: string[] = [];

    if (room.max_guests) {
      tags.push(`${room.max_guests} khách`);
    }

    if (room.propertyId?.location?.city) {
      tags.push(room.propertyId.location.city);
    }

    return tags;
  }

  /**
   * Improve text formatting for better readability
   */
  private static improveTextFormatting(text: string): string {
    return (
      text
        // Ensure proper spacing around bold text
        .replace(/\*\*([^*]+)\*\*/g, ' **$1** ')
        // Add spacing after bullet points
        .replace(/^- /g, '\n- ')
        // Add spacing after numbered lists
        .replace(/^(\d+\.)/gm, '\n$1')
        // Ensure proper spacing around section separators
        .replace(/---/g, '\n---\n')
        // Add spacing after colons in structured text
        .replace(/([^:]+):\s*([^:]+)/g, '$1: $2')
        // Clean up multiple newlines
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        // Ensure proper spacing at the beginning
        .replace(/^/, '')
        // Ensure proper spacing at the end
        .replace(/$/, '\n')
        // Final cleanup of multiple spaces
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  /**
   * Clean up text by removing unnecessary emojis/icons
   */
  private static removeIcons(text: string): string {
    // Remove common emoji patterns
    return (
      text
        // Buildings and places
        .replace(
          /[🏡🏠🏘️🏚️🏢🏣🏤🏥🏦🏨🏩🏪🏫🏬🏭🏯🏰💒🗼🗽⛪🕌🕍⛩️🕋⛲⛺🌁🌃🌄🌅🌆🌇🌉⛼]/g,
          '',
        )
        // Money and payment
        .replace(/[💰💲💵💴💶💷💸💳💱💹]/g, '')
        // Hand gestures
        .replace(/[👉👈👆👇👍👎👌👊✊👋✋👐👏🙌🙏]/g, '')
        // Electronics and devices
        .replace(
          /[📞📱📲☎️📟📠🔋🔌💻💽💾💿📀🎥🎬📺📷📹🎥🎬📽️📻📠📟📠🔋🔌]/g,
          '',
        )
        // Stars and sparkles
        .replace(/[⭐🌟✨⚡💫]/g, '')
        // Entertainment
        .replace(/[🎫🎟️🎭🎨🎪🎤🎧🎼🎹🎷🎺🎸🎻🎬🎮🎯🎱🎲🎰🧩]/g, '')
        // Tools and objects
        .replace(/[📍📌📎🧷📏📐✂️🔒🔑🔨⛏️🛠️🔧🔩⚙️🧰]/g, '')
        // Weather and nature
        .replace(
          /[🌞🌛🌜🌝🌚🌕🌖🌗🌘🌑🌒🌓🌔🌙⭐🌟💫⚡🔥💧❄️🌈☀️⛅⛈️🌤️⛱️]/g,
          '',
        )
        // Transportation
        .replace(
          /[🚗🚕🚙🚌🚎🏎️🚓🚑🚒🚐🚚🚛🚜🏍️🚲🛴🛵🚁🛸✈️🛩️🚀🛰️🚢⛵🚤🛥️⚓]/g,
          '',
        )
        // Food and drinks
        .replace(
          /[🍕🍔🍟🌭🥪🌮🌯🥙🥗🍝🍜🍲🍛🍣🍱🥟🍤🍙🍘🍥🥠🥡🍦🍧🍨🍩🍪🎂🍰🧁🥧🍫🍬🍭🍮🍯]/g,
          '',
        )
        // Activities and sports
        .replace(
          /[⚽🏀🏈⚾🎾🏐🏉🎱🏓🏸🥅🏒🏑🥍🏏⛳🏹🎣🥊🥋🎽⛷️🏂🏄‍♂️🏄‍♀️🏊‍♂️🏊‍♀️🚴‍♂️🚴‍♀️🏇🧗‍♂️🧗‍♀️]/g,
          '',
        )
        // People and faces
        .replace(
          /[😀😃😄😁😆😅😂🤣😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🤩🥳😏😒😞😔😟😕🙁☹️😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🤭🤫🤥😶😐😑😬🙄😯😦😧😮😲🥱😴🤤😪😵🤐🥴🤢🤮🤧😷🤒🤕🤑🤠😈👿👹👺🤡💩👻💀☠️👽👾🤖🎃😺😸😹😻😼😽🙀😿😾]/g,
          '',
        )
        // Hearts and symbols
        .replace(
          /[❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝💟☮️✝️☪️🕉️☸️✡️🔯🕎☯️☦️🛐⛎♈♉♊♋♌♍♎♏♐♑♒♓🆔⚛️🉑☢️☣️📴📳🈶🈚🈸🈺🈷️✴️🆚💮🉐㊙️㊗️🈴🈵🈹🈲🅰️🅱️🆎🆑🅾️🆘❌⭕🛑⛔📛🚫💯💢♨️🚷🚯🚳🚱🔞📵🚭❗❕❓❔‼️⁉️🔅🔆〽️⚠️🚸🔱⚜️🔰♻️✅🈯💹❇️✳️❎🌐💠Ⓜ️🌀💤🏧🚾♿🅿️🈳🈂️🛂🛃🛄🛅🚹🚺🚼⚧️🚻🚮🎦📶🈁🔣ℹ️🔤🔡🔠🆖🆗🆙🆒🆕🆓0️⃣1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣🔟]/g,
          '',
        )
        // Arrows and directions
        .replace(
          /[⬆️↗️➡️↘️⬇️↙️⬅️↖️↕️↔️↩️↪️⤴️⤵️🔀🔁🔂🔄🔃🎵🎶➕➖➗✖️♾️💲💱™️©️®️👁️‍🗨️🔚🔙🔛🔝🔜]/g,
          '',
        )
        // Time and calendar
        .replace(
          /[🕐🕑🕒🕓🕔🕕🕖🕗🕘🕙🕚🕛🕧🕐🕜🕝🕞🕟🕠🕡🕢🕣🕤🕥🕦🕧⏰⏱️⏲️⏳⌛⌚📅📆🗓️]/g,
          '',
        )
        // Office and documents
        .replace(
          /[📋📌📍📎🖇️📏📐✂️🗃️🗄️🗑️🔒🔓🔏🔐🔑🗝️🔨🪓⛏️⚒️🛠️🗡️⚔️💣🏹🛡️🔧🔩⚙️🗜️⚖️🦯🔗⛓️🧰🧲🪜]/g,
          '',
        )
        // Medical and science
        .replace(
          /[⚗️🧪🧫🧬🔬🔭📡💊💉🩸🧴🧼🪒🧽🧯🛎️🧿📿🔮🪅🎊🎉🎈🎁🎀🪆🪅🧧✉️📩📨📧💌📥📤📦🏷️🪧📪📫📬📭📮🗳️]/g,
          '',
        )
        // Flags and countries
        .replace(/[🏁🚩🎌🏴🏳️🏳️‍🌈🏳️‍⚧️🏴‍☠️]/g, '')
        // Convert circled numbers to regular numbers
        .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, (match) => {
          const numberMap: Record<string, string> = {
            '①': '1. ',
            '②': '2. ',
            '③': '3. ',
            '④': '4. ',
            '⑤': '5. ',
            '⑥': '6. ',
            '⑦': '7. ',
            '⑧': '8. ',
            '⑨': '9. ',
            '⑩': '10. ',
          };
          return numberMap[match] || match;
        })
        // Replace bullet points with dashes
        .replace(/[•●]/g, '- ')
        // Clean up multiple spaces and newlines
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim()
    );
  }
}
