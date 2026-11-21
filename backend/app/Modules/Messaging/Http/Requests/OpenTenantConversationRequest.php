<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Modules\Messaging\Support\MessageInput;
use Illuminate\Foundation\Http\FormRequest;

final class OpenTenantConversationRequest extends FormRequest
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
            'lease_id' => ['required', 'uuid'],
            'subject' => ['required', 'string', 'max:140'],
            ...MessageInput::rules(),
            'client_id' => ['required', 'uuid'],
        ];
    }

    public function leaseId(): string
    {
        return strtolower((string) $this->string('lease_id'));
    }

    public function subject(): string
    {
        return trim((string) $this->string('subject'));
    }
}
