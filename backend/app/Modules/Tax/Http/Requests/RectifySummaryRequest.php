<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class RectifySummaryRequest extends FormRequest
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
            'reason' => ['required', 'string', 'min:5', 'max:500'],
            'lock_version' => ['required', 'integer', 'min:1'],
            'scope' => ['prohibited'],
            'mandant_party_id' => ['prohibited'],
            'status' => ['prohibited'],
            'income_year' => ['prohibited'],
            'currency' => ['prohibited'],
            'amount' => ['prohibited'],
            'lines' => ['prohibited'],
            'snapshot' => ['prohibited'],
        ];
    }

    public function reason(): string
    {
        return trim($this->string('reason')->toString());
    }

    public function lockVersion(): int
    {
        return $this->integer('lock_version');
    }
}
