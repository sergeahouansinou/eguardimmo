<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Requests;

use App\Modules\Banking\Enums\ImportFormat;
use App\Modules\Banking\Support\CsvProfileRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class PreviewStatementRequest extends FormRequest
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
            'file' => ['required', 'file'],
            'format' => ['required', Rule::enum(ImportFormat::class)],
            ...CsvProfileRules::for(),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function profile(): ?array
    {
        $profil = $this->validated('csv_profile');

        return is_array($profil) ? $profil : null;
    }
}
