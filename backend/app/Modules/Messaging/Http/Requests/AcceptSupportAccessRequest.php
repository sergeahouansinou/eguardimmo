<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Modules\Messaging\Enums\SupportAccessScope;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class AcceptSupportAccessRequest extends FormRequest
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
            'duration_hours' => ['nullable', 'integer'],
            'scopes' => ['nullable', 'array', 'min:1', 'max:'.count(SupportAccessScope::cases())],
            'scopes.*' => ['required', 'string', Rule::enum(SupportAccessScope::class)],
        ];
    }

    public function hours(): ?int
    {
        return $this->filled('duration_hours') ? $this->integer('duration_hours') : null;
    }

    /**
     * @return list<SupportAccessScope>|null
     */
    public function scopes(): ?array
    {
        return $this->input('scopes') !== null
            ? array_values(array_map(fn (mixed $valeur): SupportAccessScope => SupportAccessScope::from((string) $valeur), (array) $this->input('scopes')))
            : null;
    }
}
