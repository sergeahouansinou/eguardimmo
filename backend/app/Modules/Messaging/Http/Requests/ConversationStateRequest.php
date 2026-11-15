<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ConversationStateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'read' => ['required_without:archived', 'boolean'],
            'archived' => ['required_without:read', 'boolean'],
        ];
    }

    public function read(): ?bool
    {
        return $this->has('read') ? $this->boolean('read') : null;
    }

    public function archived(): ?bool
    {
        return $this->has('archived') ? $this->boolean('archived') : null;
    }
}
