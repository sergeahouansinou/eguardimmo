<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Requests;

use App\Modules\Charges\Enums\ExerciseStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListExercisesRequest extends FormRequest
{
    use PaginatesWithCursor;

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
            ...$this->paginationRules(['id' => 'uuid']),
            'property_id' => ['nullable', 'uuid'],
            'status' => ['nullable', Rule::enum(ExerciseStatus::class)],
        ];
    }

    /**
     * @return array{property_id: string|null, status: string|null}
     */
    public function filters(): array
    {
        $v = $this->validated();

        return [
            'property_id' => isset($v['property_id']) ? (string) $v['property_id'] : null,
            'status' => isset($v['status']) ? (string) $v['status'] : null,
        ];
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
