<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Requests;

use App\Modules\Planning\Support\ReadsBulkTaskIds;
use Illuminate\Foundation\Http\FormRequest;

final class BulkCompleteTasksRequest extends FormRequest
{
    use ReadsBulkTaskIds;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return $this->idRules();
    }
}
