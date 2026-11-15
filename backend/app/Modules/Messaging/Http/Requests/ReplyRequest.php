<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Modules\Messaging\Support\MessageInput;
use Illuminate\Foundation\Http\FormRequest;

final class ReplyRequest extends FormRequest
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
        return [...MessageInput::rules(), 'internal' => ['nullable', 'boolean']];
    }
}
