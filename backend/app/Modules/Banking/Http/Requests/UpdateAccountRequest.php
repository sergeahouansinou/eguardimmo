<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Requests;

use App\Modules\Banking\Support\CsvProfileRules;
use Illuminate\Foundation\Http\FormRequest;

final class UpdateAccountRequest extends FormRequest
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
            'label' => ['required', 'string', 'max:120'],
            ...CsvProfileRules::for(),
        ];
    }
}
