<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Requests;

use App\Modules\Parties\Enums\IdentifierScheme;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class AddIdentifierRequest extends FormRequest
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
            'scheme' => ['required', Rule::enum(IdentifierScheme::class)],
            'country' => ['required', 'string', 'regex:/^[A-Z]{2}$/'],
            'value' => ['required', 'string', 'max:60'],
        ];
    }

    public function scheme(): IdentifierScheme
    {
        return IdentifierScheme::from((string) $this->validated('scheme'));
    }

    public function country(): string
    {
        return (string) $this->validated('country');
    }

    public function value(): string
    {
        return (string) $this->validated('value');
    }
}
