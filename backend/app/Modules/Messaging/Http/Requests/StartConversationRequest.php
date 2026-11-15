<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Modules\Messaging\Data\NewConversationData;
use App\Modules\Messaging\Support\MessageInput;
use Illuminate\Foundation\Http\FormRequest;

final class StartConversationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'recipient_id' => ['required', 'uuid'],
            'subject' => ['required', 'string', 'max:140'],
            ...MessageInput::rules(),
        ];
    }

    public function toData(): NewConversationData
    {
        return new NewConversationData(
            strtolower((string) $this->string('recipient_id')),
            trim((string) $this->string('subject')),
            MessageInput::body($this),
            MessageInput::attachments($this),
        );
    }
}
