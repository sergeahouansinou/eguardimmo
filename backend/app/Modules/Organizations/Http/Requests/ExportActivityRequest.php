<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Requests;

use App\Modules\Organizations\Support\ReadsActivityFilters;
use Illuminate\Foundation\Http\FormRequest;

final class ExportActivityRequest extends FormRequest
{
    use ReadsActivityFilters;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return $this->filterRules();
    }
}
