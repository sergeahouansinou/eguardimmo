<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class IssueExerciseRequest extends FormRequest
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
        return ['acknowledge_prescription' => ['sometimes', 'boolean']];
    }

    public function prescriptionAcknowledged(): bool
    {
        return $this->boolean('acknowledge_prescription');
    }
}
