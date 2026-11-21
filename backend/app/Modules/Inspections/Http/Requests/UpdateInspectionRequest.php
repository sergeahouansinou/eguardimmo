<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Requests;

use App\Modules\Inspections\Enums\InspectionPerformer;
use App\Modules\Inspections\Support\ReadsSignatories;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateInspectionRequest extends FormRequest
{
    use ReadsSignatories;

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
            'lock_version' => ['required', 'integer', 'min:1'],
            'performed_on' => ['sometimes', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:2000-01-01'],
            'performed_by' => ['sometimes', 'string', Rule::enum(InspectionPerformer::class)],
            'exit_matches_entry' => ['sometimes', 'nullable', 'boolean'],
            ...$this->signatoryRules(),
        ];
    }

    public function lockVersion(): int
    {
        return (int) $this->validated('lock_version');
    }

    /**
     * @return array{performed_on?: CarbonImmutable, performed_by?: InspectionPerformer, signatories?: list<array{name: string, capacity: string, date: string}>, exit_matches_entry?: bool|null}
     */
    public function changes(): array
    {
        $changements = [];

        if ($this->has('performed_on')) {
            $changements['performed_on'] = CarbonImmutable::parse((string) $this->validated('performed_on'))->startOfDay();
        }

        if ($this->has('performed_by')) {
            $changements['performed_by'] = InspectionPerformer::from((string) $this->validated('performed_by'));
        }

        if ($this->has('signatories')) {
            $changements['signatories'] = $this->signatories();
        }

        if ($this->has('exit_matches_entry')) {
            $changements['exit_matches_entry'] = $this->filled('exit_matches_entry') ? $this->boolean('exit_matches_entry') : null;
        }

        return $changements;
    }
}
