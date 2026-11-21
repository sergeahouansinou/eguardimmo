<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Modules\Messaging\Support\MessageInput;
use Illuminate\Foundation\Http\FormRequest;

final class OpenOwnerConversationRequest extends FormRequest
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
            'access_id' => ['required', 'uuid'],
            'mandate_id' => ['nullable', 'uuid'],
            'subject' => ['required', 'string', 'max:140'],
            ...MessageInput::rules(),
            'client_id' => ['required', 'uuid'],
        ];
    }

    public function accessId(): string
    {
        return strtolower((string) $this->string('access_id'));
    }

    public function mandateId(): ?string
    {
        return $this->filled('mandate_id') ? strtolower((string) $this->string('mandate_id')) : null;
    }

    public function subject(): string
    {
        return trim((string) $this->string('subject'));
    }
}
